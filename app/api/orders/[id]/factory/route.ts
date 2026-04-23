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

type RevisionRecord = {
  revisionNumber: number;
  afterJson: unknown;
};

type RevisionLineItem = {
  label: string;
  amount: number;
};

type RevisionSelection = {
  groupName: string;
  choiceLabel: string;
  choiceValue?: string | null;
  partNumber?: string | null;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount?: number;
  leatherSurcharge?: number;
  imageUrl?: string | null;
  leatherImageUrl?: string | null;
  laseredBrand?: boolean;
  laseredBrandImageUrl?: string | null;
  quantity?: number | null;
  frameNeededCode?: string | null;
  isBodyLeather?: boolean;
};

type EnrichedSelection = {
  groupName: string;
  choiceLabel: string;
  choiceValue?: string | null;
  partNumber?: string | null;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount: number;
  leatherSurcharge: number;
  imageUrl?: string | null;
  leatherImageUrl?: string | null;
  laseredBrand?: boolean;
  laseredBrandImageUrl?: string | null;
  quantity: number;
  frameNeededCode?: string | null;
  isBodyLeather?: boolean;
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

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function extractRevisionData(revisions: RevisionRecord[]) {
  let latestQuantity = 1;

  for (const revision of revisions) {
    if (!revision.afterJson || typeof revision.afterJson !== "object") {
      continue;
    }

    const afterJson = revision.afterJson as {
      selections?: unknown;
      quantity?: unknown;
      lineItems?: unknown;
    };

    if (afterJson.quantity !== undefined) {
      latestQuantity = sanitizeQuantity(
        typeof afterJson.quantity === "number"
          ? afterJson.quantity
          : Number(afterJson.quantity ?? 1)
      );
    }

    const lineItems = Array.isArray(afterJson.lineItems)
      ? afterJson.lineItems
          .map((item) => {
            if (!item || typeof item !== "object") {
              return null;
            }

            const line = item as {
              label?: unknown;
              amount?: unknown;
            };

            if (typeof line.label !== "string") {
              return null;
            }

            return {
              label: line.label,
              amount: Number(line.amount || 0),
            } satisfies RevisionLineItem;
          })
          .filter(Boolean) as RevisionLineItem[]
      : [];

    if (!Array.isArray(afterJson.selections)) {
      continue;
    }

    const selections = afterJson.selections
      .map((item) => {
        if (!item || typeof item !== "object") {
          return null;
        }

        const selection = item as {
          groupName?: unknown;
          choiceLabel?: unknown;
          choiceValue?: unknown;
          partNumber?: unknown;
          leatherName?: unknown;
          leatherGrade?: unknown;
          baseAmount?: unknown;
          leatherSurcharge?: unknown;
          imageUrl?: unknown;
          leatherImageUrl?: unknown;
          laseredBrand?: unknown;
          laseredBrandImageUrl?: unknown;
          quantity?: unknown;
          frameNeededCode?: unknown;
          isBodyLeather?: unknown;
        };

        if (
          typeof selection.groupName !== "string" ||
          typeof selection.choiceLabel !== "string"
        ) {
          return null;
        }

        return {
          groupName: selection.groupName,
          choiceLabel: selection.choiceLabel,
          choiceValue:
            typeof selection.choiceValue === "string"
              ? selection.choiceValue
              : null,
          partNumber:
            typeof selection.partNumber === "string"
              ? selection.partNumber
              : null,
          leatherName:
            typeof selection.leatherName === "string"
              ? selection.leatherName
              : null,
          leatherGrade:
            typeof selection.leatherGrade === "string"
              ? selection.leatherGrade
              : null,
          baseAmount: Number(selection.baseAmount || 0),
          leatherSurcharge: Number(selection.leatherSurcharge || 0),
          imageUrl:
            typeof selection.imageUrl === "string" ? selection.imageUrl : null,
          leatherImageUrl:
            typeof selection.leatherImageUrl === "string"
              ? selection.leatherImageUrl
              : null,
          laseredBrand: Boolean(selection.laseredBrand),
          laseredBrandImageUrl:
            typeof selection.laseredBrandImageUrl === "string"
              ? selection.laseredBrandImageUrl
              : null,
          quantity: sanitizeQuantity(
            typeof selection.quantity === "number"
              ? selection.quantity
              : Number(selection.quantity || 1)
          ),
          frameNeededCode:
            typeof selection.frameNeededCode === "string"
              ? selection.frameNeededCode
              : null,
          isBodyLeather: Boolean(selection.isBodyLeather),
        } satisfies RevisionSelection;
      })
      .filter(Boolean) as RevisionSelection[];

    return {
      quantity: latestQuantity,
      selections,
      lineItems,
    };
  }

  return {
    quantity: latestQuantity,
    selections: [] as RevisionSelection[],
    lineItems: [] as RevisionLineItem[],
  };
}

function buildSelectionsFromItem(
  item: ItemWithSelections,
  revisionSelections: RevisionSelection[],
  orderQuantity: number
) {
  const baseSelections = item.selections.filter(
    (selection: SelectionSnapshot) =>
      !selection.optionGroupNameSnapshot.endsWith(" Leather") &&
      !selection.optionGroupNameSnapshot.endsWith(" Lasered Brand") &&
      !selection.optionGroupNameSnapshot.endsWith(" Lasered Brand Image")
  );

  return baseSelections.map((baseSelection: SelectionSnapshot) => {
    const groupName = baseSelection.optionGroupNameSnapshot;
    const choiceLabel = baseSelection.optionChoiceNameSnapshot;

    const revisionMatch =
      revisionSelections.find(
        (selection) =>
          selection.groupName === groupName &&
          selection.choiceLabel === choiceLabel
      ) || null;

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

    let leatherName: string | null = revisionMatch?.leatherName || null;
    let leatherGrade: string | null = revisionMatch?.leatherGrade || null;
    let leatherSurcharge = Number(revisionMatch?.leatherSurcharge || 0);

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
      ? parseScopedValue(matchingLaseredBrandImage.optionChoiceNameSnapshot).value
      : null;

    return {
      groupName,
      choiceLabel,
      choiceValue: revisionMatch?.choiceValue || null,
      partNumber:
        revisionMatch?.partNumber ||
        revisionMatch?.choiceValue ||
        null,
      leatherName,
      leatherGrade,
      baseAmount:
        Number(baseSelection.priceDeltaSnapshot || 0) ||
        Number(revisionMatch?.baseAmount || 0),
      leatherSurcharge,
      imageUrl: revisionMatch?.imageUrl || null,
      leatherImageUrl: revisionMatch?.leatherImageUrl || null,
      laseredBrand: Boolean(parsedLaseredBrand || revisionMatch?.laseredBrand),
      laseredBrandImageUrl:
        parsedLaseredBrandImage ||
        revisionMatch?.laseredBrandImageUrl ||
        null,
      quantity: orderQuantity,
      frameNeededCode: revisionMatch?.frameNeededCode || null,
      isBodyLeather: Boolean(revisionMatch?.isBodyLeather),
    };
  });
}

function buildBodyLeather(selections: EnrichedSelection[]) {
  const uniqueValues = new Set<string>();

  for (const selection of selections) {
    if (!selection.isBodyLeather || !selection.leatherName) {
      continue;
    }

    const leatherValue = `${selection.leatherName}${
      selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
    }`.trim();

    if (leatherValue) {
      uniqueValues.add(leatherValue);
    }
  }

  return Array.from(uniqueValues).join(", ");
}

function buildSheetParts(selections: EnrichedSelection[]) {
  const seen = new Set<string>();

  return selections
    .map((selection) => {
      const partNumber = String(
        selection.partNumber || selection.choiceValue || ""
      ).trim();

      const frameNeeded = String(selection.frameNeededCode || "").trim();

      return {
        partNumber,
        frameNeeded,
      };
    })
    .filter((part) => part.partNumber && part.frameNeeded)
    .filter((part) => {
      const key = `${part.partNumber}|||${part.frameNeeded}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
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
        },
      },
    });

    if (!order || order.items.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const item = order.items[0] as ItemWithSelections;
const { quantity, selections: revisionSelections, lineItems } =
  extractRevisionData(order.revisions as RevisionRecord[]);

    const selections = buildSelectionsFromItem(
      item,
      revisionSelections,
      quantity
    );

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
            poNumber: order.poNumber,
          },
          afterJson: {
            status: nextStatus,
            poNumber: order.poNumber,
            quantity,
          },
        },
      }),
    ]);

    try {
await sendOrderNotification({
  type: action === "sent_to_factory" ? "sent_to_factory" : "completed",
  orderNumber: order.orderNumber,
  poNumber: order.poNumber || null,
  quantity,
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  customerPhone: order.customerPhone,
  notes: order.notes,
  productName: item.productNameSnapshot,
  total: Number(order.total),
  lineItems,
  selections: enrichedSelections.map((selection) => ({
    groupName: selection.groupName,
    choiceLabel: selection.choiceLabel,
    leatherName: selection.leatherName || null,
    leatherGrade: selection.leatherGrade || null,
    baseAmount: Number(selection.baseAmount || 0),
    leatherSurcharge: Number(selection.leatherSurcharge || 0),
    imageUrl: selection.imageUrl || null,
    leatherImageUrl: selection.leatherImageUrl || null,
    laseredBrand: Boolean(selection.laseredBrand),
    laseredBrandImageUrl: selection.laseredBrandImageUrl || null,
    isBodyLeather: Boolean(selection.isBodyLeather),
  })),
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

    if (action === "sent_to_factory" && order.status !== "SENT_TO_FACTORY") {
      try {
        const bodyLeather = buildBodyLeather(enrichedSelections);
        const parts = buildSheetParts(enrichedSelections);

        if (parts.length > 0) {
          await appendOrderRow({
            poNumber: order.poNumber || null,
            customerName: order.customerName,
            quantity,
            bodyLeather: bodyLeather || null,
            dateSold: new Date(),
            parts,
          });
        }

        await prisma.sheetSyncLog.create({
          data: {
            orderId: id,
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
            worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
            spreadsheetRowId: parts.length > 0 ? "APPENDED" : "NO_PART_ROWS",
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