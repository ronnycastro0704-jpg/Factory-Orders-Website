import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";
import { sendOrderNotification } from "../../../../../lib/email";
import { appendOrderRow } from "../../../../../lib/sheets";

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

type EnrichedSelection = {
  groupName: string;
  choiceLabel: string;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount: number;
  leatherSurcharge: number;
  imageUrl?: string | null;
  leatherImageUrl?: string | null;
  laseredBrand?: boolean;
  laseredBrandImageUrl?: string | null;
};

const SELECTION_META_SEPARATOR = "|||";

function parseScopedValue(raw: string) {
  const index = raw.indexOf(SELECTION_META_SEPARATOR);

  if (index === -1) {
    return {
      choiceLabel: null,
      value: raw,
    };
  }

  return {
    choiceLabel: raw.slice(0, index),
    value: raw.slice(index + SELECTION_META_SEPARATOR.length),
  };
}

function buildSelectionsFromItem(item: ItemWithSelections) {
  const baseSelections = item.selections.filter(
    (selection: SelectionSnapshot) =>
      !selection.optionGroupNameSnapshot.endsWith(" Leather") &&
      !selection.optionGroupNameSnapshot.endsWith(" Lasered Brand") &&
      !selection.optionGroupNameSnapshot.endsWith(" Lasered Brand Image")
  );

  return baseSelections.map((baseSelection: SelectionSnapshot) => {
    const groupName = baseSelection.optionGroupNameSnapshot;
    const choiceLabel = baseSelection.optionChoiceNameSnapshot;

    const sameGroupBaseCount = baseSelections.filter(
      (selection: SelectionSnapshot) =>
        selection.optionGroupNameSnapshot === groupName
    ).length;

    const leatherCandidates = item.selections.filter(
      (selection: SelectionSnapshot) =>
        selection.optionGroupNameSnapshot === `${groupName} Leather`
    );

    const laseredBrandCandidates = item.selections.filter(
      (selection: SelectionSnapshot) =>
        selection.optionGroupNameSnapshot === `${groupName} Lasered Brand`
    );

    const laseredBrandImageCandidates = item.selections.filter(
      (selection: SelectionSnapshot) =>
        selection.optionGroupNameSnapshot === `${groupName} Lasered Brand Image`
    );

    const matchingLeather =
      leatherCandidates.find((selection: SelectionSnapshot) => {
        const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
        return parsed.choiceLabel === choiceLabel;
      }) ??
      (sameGroupBaseCount === 1
        ? leatherCandidates.find((selection: SelectionSnapshot) => {
            const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
            return parsed.choiceLabel === null;
          })
        : undefined);

    const matchingLaseredBrand =
      laseredBrandCandidates.find((selection: SelectionSnapshot) => {
        const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
        return parsed.choiceLabel === choiceLabel;
      }) ??
      (sameGroupBaseCount === 1
        ? laseredBrandCandidates.find((selection: SelectionSnapshot) => {
            const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
            return parsed.choiceLabel === null;
          })
        : undefined);

    const matchingLaseredBrandImage =
      laseredBrandImageCandidates.find((selection: SelectionSnapshot) => {
        const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
        return parsed.choiceLabel === choiceLabel;
      }) ??
      (sameGroupBaseCount === 1
        ? laseredBrandImageCandidates.find((selection: SelectionSnapshot) => {
            const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
            return parsed.choiceLabel === null;
          })
        : undefined);

    let leatherName: string | null = null;
    let leatherGrade: string | null = null;
    let leatherSurcharge = 0;

    if (matchingLeather) {
      const parsedLeather = parseScopedValue(
        matchingLeather.optionChoiceNameSnapshot
      ).value;

      const match = parsedLeather.match(/^(.*?)(?: \((.*?)\))?$/);
      leatherName = match?.[1] || parsedLeather;
      leatherGrade = match?.[2] || null;
      leatherSurcharge = Number(matchingLeather.priceDeltaSnapshot || 0);
    }

    const parsedLaseredBrand =
      matchingLaseredBrand &&
      parseScopedValue(matchingLaseredBrand.optionChoiceNameSnapshot).value ===
        "Yes";

    const parsedLaseredBrandImage = matchingLaseredBrandImage
      ? parseScopedValue(matchingLaseredBrandImage.optionChoiceNameSnapshot)
          .value
      : null;

    return {
      groupName,
      choiceLabel,
      leatherName,
      leatherGrade,
      baseAmount: Number(baseSelection.priceDeltaSnapshot || 0),
      leatherSurcharge,
      imageUrl: null,
      leatherImageUrl: null,
      laseredBrand: Boolean(parsedLaseredBrand),
      laseredBrandImageUrl: parsedLaseredBrandImage || null,
    };
  });
}

function buildSelectionsText(selections: EnrichedSelection[]) {
  return selections
    .map((selection: EnrichedSelection) => {
      const lines = [`${selection.groupName}: ${selection.choiceLabel}`];

      if (selection.leatherName) {
        lines.push(
          `Leather: ${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`
        );
      }

      if (selection.laseredBrand) {
        lines.push("Lasered Brand: Yes");
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

    const item = order.items[0] as ItemWithSelections;

    const selections = buildSelectionsFromItem(item);

    const enrichedSelections: EnrichedSelection[] = await Promise.all(
      selections.map(async (selection: EnrichedSelection) => {
        let leatherImageUrl = selection.leatherImageUrl || null;

        if (selection.leatherName && !leatherImageUrl) {
          const leather = await prisma.leather.findFirst({
            where: {
              name: selection.leatherName,
            },
            select: {
              imageUrl: true,
            },
          });

          leatherImageUrl = leather?.imageUrl || null;
        }

        return {
          ...selection,
          leatherImageUrl,
        };
      })
    );

    const nextRevisionNumber =
      order.revisions.length > 0 ? order.revisions[0].revisionNumber + 1 : 1;

    const nextStatus =
      action === "sent_to_factory" ? "SENT_TO_FACTORY" : "COMPLETED";

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: {
          status: nextStatus,
          ...(action === "sent_to_factory"
            ? {
                sentToFactoryAt: new Date(),
              }
            : {}),
        },
      }),
      prisma.orderRevision.create({
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
      }),
    ]);

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
        selections: enrichedSelections,
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
        selectionsText: buildSelectionsText(enrichedSelections),
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