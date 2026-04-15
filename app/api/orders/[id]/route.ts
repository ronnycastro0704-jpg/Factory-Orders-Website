import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendOrderNotification } from "../../../../lib/email";
import { appendOrderRow } from "../../../../lib/sheets";

type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type IncomingLineItem = {
  label: string;
  amount: number;
};

type IncomingSelection = {
  groupName: string;
  choiceLabel: string;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount: number;
  leatherSurcharge: number;
  imageUrl?: string | null;
};

function buildSelectionRows(selections: IncomingSelection[]) {
  return selections.flatMap((selection) => {
    const rows = [
      {
        optionGroupNameSnapshot: selection.groupName,
        optionChoiceNameSnapshot: selection.choiceLabel,
        priceDeltaSnapshot: selection.baseAmount,
      },
    ];

    if (selection.leatherName) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Leather`,
        optionChoiceNameSnapshot: `${selection.leatherName}${
          selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
        }`,
        priceDeltaSnapshot: selection.leatherSurcharge || 0,
      });
    }

    return rows;
  });
}

function buildSelectionsText(selections: IncomingSelection[]) {
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

export async function GET(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const order = await prisma.order.findUnique({
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

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load order." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const notes = String(body.notes || "").trim();
    const status = String(body.status || "").trim();
    const changeReason = String(body.changeReason || "").trim();

    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : null;

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : null;

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Customer email is required." },
        { status: 400 }
      );
    }

    const existingOrder = await prisma.order.findUnique({
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

    if (!existingOrder) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const existingItem = existingOrder.items[0] || null;
    const hasConfigUpdate =
      !!existingItem &&
      selections !== null &&
      lineItems !== null &&
      !Number.isNaN(total);

    const nextRevisionNumber =
      existingOrder.revisions.length > 0
        ? existingOrder.revisions[0].revisionNumber + 1
        : 1;

    const finalStatus = status
      ? status
      : hasConfigUpdate
      ? "CHANGED"
      : existingOrder.status;

    const beforeSnapshot = {
      customerName: existingOrder.customerName,
      customerEmail: existingOrder.customerEmail,
      customerPhone: existingOrder.customerPhone,
      notes: existingOrder.notes,
      status: existingOrder.status,
      total: Number(existingOrder.total),
    };

await prisma.$transaction(async (tx: TransactionClient) => {
      await tx.order.update({
        where: { id },
        data: {
          customerName,
          customerEmail,
          customerPhone: customerPhone || null,
          notes: notes || null,
          status: finalStatus as
            | "DRAFT"
            | "SUBMITTED"
            | "CHANGED"
            | "SENT_TO_FACTORY"
            | "COMPLETED"
            | "CANCELLED",
          ...(hasConfigUpdate
            ? {
                subtotal: total,
                total,
              }
            : {}),
        },
      });

      if (hasConfigUpdate && existingItem && selections) {
        await tx.orderItem.update({
          where: { id: existingItem.id },
          data: {
            productNameSnapshot:
              productName || existingItem.productNameSnapshot,
            ...(basePrice > 0
              ? {
                  basePriceSnapshot: basePrice,
                }
              : {}),
            lineTotal: total,
            selections: {
              deleteMany: {},
              create: buildSelectionRows(selections),
            },
          },
        });
      }

      await tx.orderRevision.create({
        data: {
          orderId: id,
          revisionNumber: nextRevisionNumber,
          changedBy: customerEmail,
          changeReason:
            changeReason ||
            (hasConfigUpdate
              ? "Customer edited order configuration"
              : "Order details updated"),
          beforeJson: beforeSnapshot,
          afterJson: {
            customerName,
            customerEmail,
            customerPhone,
            notes,
            status: finalStatus,
            total: hasConfigUpdate ? total : Number(existingOrder.total),
            productName: productName || existingItem?.productNameSnapshot || "",
            selections: selections || [],
            lineItems: lineItems || [],
          },
        },
      });
    });

    if (hasConfigUpdate && selections) {
      try {
        await sendOrderNotification({
          type: "updated",
          orderNumber: existingOrder.orderNumber,
          customerName,
          customerEmail,
          customerPhone,
          notes,
          productName: productName || existingItem?.productNameSnapshot || "",
          total,
          selections,
        });

        await prisma.emailLog.createMany({
          data: [
            {
              orderId: id,
              eventType: "ORDER_UPDATED_CUSTOMER",
              recipient: customerEmail,
              subject: `Your order was updated: ${existingOrder.orderNumber}`,
              status: "SENT",
            },
            {
              orderId: id,
              eventType: "ORDER_UPDATED_INTERNAL",
              recipient: process.env.ORDER_NOTIFY_TO || "",
              subject: `Order Updated: ${existingOrder.orderNumber}`,
              status: "SENT",
            },
          ],
        });
      } catch (error) {
        console.error("ORDER UPDATE EMAIL ERROR:", error);

        await prisma.emailLog.create({
          data: {
            orderId: id,
            eventType: "ORDER_UPDATED",
            recipient: customerEmail,
            subject: `Your order was updated: ${existingOrder.orderNumber}`,
            status: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Unknown email error",
          },
        });
      }

      try {
        await appendOrderRow({
          eventType: "updated",
          orderNumber: existingOrder.orderNumber,
          status: finalStatus,
          customerName,
          customerEmail,
          customerPhone,
          productName: productName || existingItem?.productNameSnapshot || "",
          total,
          notes,
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
        console.error("ORDER UPDATE SHEETS ERROR:", error);

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
    console.error("UPDATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 }
    );
  }
}