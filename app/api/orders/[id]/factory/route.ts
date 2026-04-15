import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { sendOrderNotification } from "../../../../../lib/email";
import { appendOrderRow } from "../../../../../lib/sheets";

type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type SelectionSnapshot = {
  optionGroupNameSnapshot: string;
  optionChoiceNameSnapshot: string;
  priceDeltaSnapshot: unknown;
};

type ItemWithSelections = {
  productNameSnapshot: string;
  selections: SelectionSnapshot[];
};

function buildSelectionsFromItem(item: ItemWithSelections) {
  const grouped = new Map<
    string,
    {
      groupName: string;
      choiceLabel: string;
      leatherName?: string | null;
      leatherGrade?: string | null;
      baseAmount: number;
      leatherSurcharge: number;
      imageUrl?: string | null;
    }
  >();

  for (const selection of item.selections) {
    const groupName = selection.optionGroupNameSnapshot;
    const amount = Number(selection.priceDeltaSnapshot);

    if (groupName.endsWith(" Leather")) {
      const baseGroupName = groupName.replace(/ Leather$/, "");
      const existing = grouped.get(baseGroupName);

      const leatherText = selection.optionChoiceNameSnapshot;
      const match = leatherText.match(/^(.*?)(?: \((.*?)\))?$/);

      grouped.set(baseGroupName, {
        groupName: baseGroupName,
        choiceLabel: existing?.choiceLabel || "",
        baseAmount: existing?.baseAmount || 0,
        leatherName: match?.[1] || leatherText,
        leatherGrade: match?.[2] || null,
        leatherSurcharge: amount,
        imageUrl: null,
      });
    } else {
      const existing = grouped.get(groupName);

      grouped.set(groupName, {
        groupName,
        choiceLabel: selection.optionChoiceNameSnapshot,
        baseAmount: amount,
        leatherName: existing?.leatherName || null,
        leatherGrade: existing?.leatherGrade || null,
        leatherSurcharge: existing?.leatherSurcharge || 0,
        imageUrl: null,
      });
    }
  }

  return Array.from(grouped.values());
}

function buildSelectionsText(
  selections: ReturnType<typeof buildSelectionsFromItem>
) {
  return selections
    .map((selection) => {
      const lines = [`${selection.groupName}: ${selection.choiceLabel}`];
      if (selection.leatherName) {
        lines.push(
          `Leather: ${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`
        );
      }
      return lines.join(" | ");
    })
    .join(" || ");
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const action = String(body.action || "").trim();

    if (!["sent_to_factory", "completed"].includes(action)) {
      return NextResponse.json({ error: "Invalid action." }, { status: 400 });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            selections: true,
          },
        },
        revisions: {
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
      },
    });

    if (!order || order.items.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const item = order.items[0];
    const selections = buildSelectionsFromItem(item);

    const nextRevisionNumber =
      order.revisions.length > 0 ? order.revisions[0].revisionNumber + 1 : 1;

    const nextStatus =
      action === "sent_to_factory" ? "SENT_TO_FACTORY" : "COMPLETED";

await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.order.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(action === "sent_to_factory"
            ? {
                sentToFactoryAt: new Date(),
              }
            : {}),
        },
      });

      await tx.orderRevision.create({
        data: {
          orderId: id,
          revisionNumber: nextRevisionNumber,
          changedBy: "admin",
          changeReason:
            action === "sent_to_factory"
              ? "Order sent to factory"
              : "Order marked completed",
          beforeJson: {
            status: order.status,
          },
          afterJson: {
            status: nextStatus,
          },
        },
      });
    });

    try {
      await sendOrderNotification({
        type: action === "sent_to_factory" ? "sent_to_factory" : "completed",
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        notes: order.notes,
        productName: item.productNameSnapshot,
        total: Number(order.total),
        selections,
      });

      await prisma.emailLog.createMany({
        data: [
          {
            orderId: id,
            eventType:
              action === "sent_to_factory"
                ? "ORDER_SENT_TO_FACTORY_CUSTOMER"
                : "ORDER_COMPLETED_CUSTOMER",
            recipient: order.customerEmail,
            subject:
              action === "sent_to_factory"
                ? `Your order was sent to the factory: ${order.orderNumber}`
                : `Your order is completed: ${order.orderNumber}`,
            status: "SENT",
          },
          {
            orderId: id,
            eventType:
              action === "sent_to_factory"
                ? "ORDER_SENT_TO_FACTORY_INTERNAL"
                : "ORDER_COMPLETED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject:
              action === "sent_to_factory"
                ? `Order Sent to Factory: ${order.orderNumber}`
                : `Order Completed: ${order.orderNumber}`,
            status: "SENT",
          },
        ],
      });
    } catch (error) {
      console.error("FACTORY EMAIL ERROR:", error);

      await prisma.emailLog.create({
        data: {
          orderId: id,
          eventType:
            action === "sent_to_factory"
              ? "ORDER_SENT_TO_FACTORY"
              : "ORDER_COMPLETED",
          recipient: order.customerEmail,
          subject:
            action === "sent_to_factory"
              ? `Your order was sent to the factory: ${order.orderNumber}`
              : `Your order is completed: ${order.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    try {
      await appendOrderRow({
        eventType: "updated",
        orderNumber: order.orderNumber,
        status: nextStatus,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        productName: item.productNameSnapshot,
        total: Number(order.total),
        notes: order.notes,
        selectionsText: buildSelectionsText(selections),
      });

      await prisma.sheetSyncLog.create({
        data: {
          orderId: id,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "APPENDED",
          status: "SYNCED",
        },
      });
    } catch (error) {
      console.error("FACTORY SHEETS ERROR:", error);

      await prisma.sheetSyncLog.create({
        data: {
          orderId: id,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "APPEND_FAILED",
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown sheets error",
        },
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            selections: true,
          },
        },
        revisions: {
          orderBy: { createdAt: "desc" },
        },
        emailLogs: {
          orderBy: { createdAt: "desc" },
        },
        sheetSyncLogs: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("FACTORY ACTION ERROR:", error);
    return NextResponse.json(
      { error: "Failed to process factory action." },
      { status: 500 }
    );
  }
}