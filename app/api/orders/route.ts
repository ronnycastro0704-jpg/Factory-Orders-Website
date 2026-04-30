import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { sendOrderNotification } from "../../../lib/email";
import { appendOrderRow } from "../../../lib/sheets";
import { getApprovedCustomerProfile } from "../../../lib/approved-customer";

type IncomingSelection = {
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
  quantity?: number | null;
  frameNeededCode?: string | null;
  isBodyLeather?: boolean;
  leatherInventoryUsage?: number | null;
};

type ResolvedSelection = IncomingSelection & {
  leatherInventoryUsage: number;
};

type IncomingLineItem = {
  label: string;
  amount: number;
};

type OrderPriority = "NORMAL" | "RUSH" | "HOLD";

type ProductionLineSeed = {
  productNameSnapshot: string;
  optionGroupNameSnapshot: string | null;
  optionChoiceNameSnapshot: string | null;
  partNumber: string;
  frameNeeded: string;
  quantity: number;
  bodyLeather: string | null;
  dueDate: Date | null;
  priority: OrderPriority;
};

type LeatherInventoryDelta = {
  leatherName: string;
  units: number;
};

const SELECTION_META_SEPARATOR = "|||";

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}


function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `FO-${yyyy}${mm}${dd}-${suffix}`;
}

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizePriority(value: unknown): OrderPriority {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "HOT") {
    return "HOLD";
  }

  if (raw === "NORMAL" || raw === "RUSH" || raw === "HOLD") {
    return raw;
  }

  return "NORMAL";
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function enrichSelectionsWithLeatherUsage(
  productId: string,
  selections: IncomingSelection[]
): Promise<ResolvedSelection[]> {
  const groups = await prisma.optionGroup.findMany({
    where: { productId },
    select: {
      name: true,
      choices: {
        select: {
          label: true,
          leatherInventoryUsage: true,
        },
      },
    },
  });

  const usageMap = new Map<string, number>();

  for (const group of groups) {
    for (const choice of group.choices) {
      usageMap.set(
        `${group.name}|||${choice.label}`,
        Number(choice.leatherInventoryUsage || 0)
      );
    }
  }

  return selections.map((selection) => ({
    ...selection,
    leatherInventoryUsage: Number(
      selection.leatherInventoryUsage ??
        usageMap.get(`${selection.groupName}|||${selection.choiceLabel}`) ??
        0
    ),
  }));
}

function buildSelectionRows(selections: ResolvedSelection[]) {
  const rows: Array<{
    optionGroupNameSnapshot: string;
    optionChoiceNameSnapshot: string;
    optionChoiceImageUrlSnapshot: string | null;
    leatherNameSnapshot: string | null;
    leatherGradeSnapshot: string | null;
    leatherImageUrlSnapshot: string | null;
    laseredBrandImageUrlSnapshot: string | null;
    priceDeltaSnapshot: number;
    leatherInventoryUsageSnapshot: number | null;
  }> = [];

  for (const selection of selections) {
    rows.push({
      optionGroupNameSnapshot: selection.groupName,
      optionChoiceNameSnapshot: selection.choiceLabel,
      optionChoiceImageUrlSnapshot: selection.imageUrl || null,
      leatherNameSnapshot: null,
      leatherGradeSnapshot: null,
      leatherImageUrlSnapshot: null,
      laseredBrandImageUrlSnapshot: null,
      priceDeltaSnapshot: Number(selection.baseAmount || 0),
      leatherInventoryUsageSnapshot: Number(
        selection.leatherInventoryUsage || 0
      ),
    });

    if (selection.leatherName) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Leather`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.leatherName}${
          selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
        }`,
        optionChoiceImageUrlSnapshot: null,
        leatherNameSnapshot: selection.leatherName || null,
        leatherGradeSnapshot: selection.leatherGrade || null,
        leatherImageUrlSnapshot: selection.leatherImageUrl || null,
        laseredBrandImageUrlSnapshot: null,
        priceDeltaSnapshot: Number(selection.leatherSurcharge || 0),
        leatherInventoryUsageSnapshot: null,
      });
    }

    if (selection.laseredBrand) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}Yes`,
        optionChoiceImageUrlSnapshot: null,
        leatherNameSnapshot: null,
        leatherGradeSnapshot: null,
        leatherImageUrlSnapshot: null,
        laseredBrandImageUrlSnapshot: selection.laseredBrandImageUrl || null,
        priceDeltaSnapshot: 0,
        leatherInventoryUsageSnapshot: null,
      });
    }

    if (selection.laseredBrandImageUrl) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand Image`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.laseredBrandImageUrl}`,
        optionChoiceImageUrlSnapshot: null,
        leatherNameSnapshot: null,
        leatherGradeSnapshot: null,
        leatherImageUrlSnapshot: null,
        laseredBrandImageUrlSnapshot: selection.laseredBrandImageUrl || null,
        priceDeltaSnapshot: 0,
        leatherInventoryUsageSnapshot: null,
      });
    }
  }

  return rows;
}

function buildBodyLeather(selections: ResolvedSelection[]) {
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

function buildSheetParts(selections: ResolvedSelection[]) {
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

function buildProductionLines(
  selections: ResolvedSelection[],
  productNameSnapshot: string,
  quantity: number,
  bodyLeather: string | null,
  dueDate: Date | null,
  priority: OrderPriority
) {
  const seen = new Map<string, ProductionLineSeed>();

  for (const selection of selections) {
    const partNumber = String(
      selection.partNumber || selection.choiceValue || ""
    ).trim();
    const frameNeeded = String(selection.frameNeededCode || "").trim();

    if (!partNumber || !frameNeeded) {
      continue;
    }

    const key = `${partNumber}|||${frameNeeded}`;

    if (!seen.has(key)) {
      seen.set(key, {
        productNameSnapshot,
        optionGroupNameSnapshot: selection.groupName || null,
        optionChoiceNameSnapshot: selection.choiceLabel || null,
        partNumber,
        frameNeeded,
        quantity,
        bodyLeather,
        dueDate,
        priority,
      });
    }
  }

  return Array.from(seen.values());
}

function buildQuantityLedgerEntries(
  orderId: string,
  orderNumber: string,
  poNumber: string | null,
  customerName: string,
  reason: "ORDER_SENT_TO_FACTORY" | "ORDER_EDITED" | "ORDER_CANCELLED",
  source: string,
  parts: Array<{ partNumber: string; frameNeeded: string; qtyChange: number }>
) {
  return parts.map((part) => ({
    orderId,
    orderNumber,
    poNumber,
    customerName,
    partNumber: part.partNumber,
    frameNeeded: part.frameNeeded,
    qtyChange: part.qtyChange,
    reason,
    source,
  }));
}

function buildLeatherInventoryDeltas(
  selections: ResolvedSelection[],
  orderQuantity: number
): LeatherInventoryDelta[] {
  const grouped = new Map<string, number>();

  for (const selection of selections) {
    const leatherName = String(selection.leatherName || "").trim();
    const usage = Number(selection.leatherInventoryUsage || 0);

    if (!leatherName || usage <= 0) {
      continue;
    }

    grouped.set(
      leatherName,
      roundToTwo((grouped.get(leatherName) || 0) + usage * orderQuantity)
    );
  }

  return Array.from(grouped.entries()).map(([leatherName, units]) => ({
    leatherName,
    units,
  }));
}

async function applyLeatherInventoryDeltas(
  tx: Omit<
    Prisma.TransactionClient,
    "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
  >,
  deltas: LeatherInventoryDelta[]
) {
  if (deltas.length === 0) {
    return;
  }

  const leathers = await tx.leather.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  const leatherMap = new Map(
    leathers.map((leather) => [leather.name.trim().toLowerCase(), leather])
  );

  for (const delta of deltas) {
    const leather = leatherMap.get(delta.leatherName.trim().toLowerCase());

    if (!leather || !delta.units) {
      continue;
    }

    if (delta.units > 0) {
      await tx.leather.update({
        where: { id: leather.id },
        data: {
          inventoryUnits: {
            decrement: delta.units,
          },
        },
      });
    } else {
      await tx.leather.update({
        where: { id: leather.id },
        data: {
          inventoryUnits: {
            increment: Math.abs(delta.units),
          },
        },
      });
    }
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to place an order." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const signedInEmail = normalizeEmail(session.user.email);
    const approvedCustomer = await getApprovedCustomerProfile(signedInEmail);

    if (!approvedCustomer) {
      return NextResponse.json(
        { error: "This email is not approved to place customer orders." },
        { status: 403 }
      );
    }

    const productId = String(body.productId || "").trim();
const poNumber = String(body.poNumber || "").trim();

if (!poNumber) {
  return NextResponse.json(
    { error: "PO # is required." },
    { status: 400 }
  );
}
    const customerName = approvedCustomer.name;
    const customerEmail = approvedCustomer.email;
    const customerPhone = String(body.customerPhone || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);
    const submitToFactory = Boolean(body.submitToFactory);
    const quantity = sanitizeQuantity(
      Number(body.quantity ?? body.orderQuantity ?? body.selections?.[0]?.quantity ?? 1)
    );
    const priority = normalizePriority(body.priority);
    const createdAt = new Date();
    const dueDate = addDays(createdAt, 56);

    const rawSelections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }


    if (rawSelections.length === 0) {
      return NextResponse.json(
        { error: "At least one selection is required." },
        { status: 400 }
      );
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });

    if (!product || !product.active) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const submittingUser = await prisma.user.findUnique({
      where: { email: signedInEmail },
      select: { id: true },
    });

    const selections = await enrichSelectionsWithLeatherUsage(
      productId,
      rawSelections
    );

    const selectionRows = buildSelectionRows(selections);
    const orderNumber = generateOrderNumber();
    const nextStatus = submitToFactory ? "SENT_TO_FACTORY" : "DRAFT";
    const bodyLeather = buildBodyLeather(selections) || null;
    const parts = buildSheetParts(selections);
    const productionLines = buildProductionLines(
      selections,
      productName || product.name,
      quantity,
      bodyLeather,
      dueDate,
      priority
    );
    const leatherInventoryDeltas = buildLeatherInventoryDeltas(
      selections,
      quantity
    );

    const createdOrder = await prisma.order.create({
      data: {
        orderNumber,
        poNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        status: nextStatus,
        subtotal: total,
        total,
        createdAt,
        sentToFactoryAt: submitToFactory ? createdAt : null,
        quantity,
        dueDate,
        priority,
        overallProductionStatus: "NEW",
        ...(submittingUser?.id ? { userId: submittingUser.id } : {}),
        items: {
          create: [
            {
              productId,
              productNameSnapshot: productName || product.name,
              basePriceSnapshot: basePrice,
              quantity,
              lineTotal: total,
              selections: {
                create: selectionRows,
              },
            },
          ],
        },
        revisions: {
          create: {
            revisionNumber: 1,
            changedBy: signedInEmail,
            changeReason: submitToFactory
              ? "Order created and sent to factory"
              : "Order created",
            beforeJson: Prisma.JsonNull,
            afterJson: {
              status: nextStatus,
              poNumber,
              quantity,
              priority,
              dueDate,
              selections,
              lineItems,
            },
          },
        },
      },
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

    if (submitToFactory) {
      await prisma.$transaction(async (tx) => {
        if (productionLines.length > 0) {
          await tx.productionLine.createMany({
            data: productionLines.map((line) => ({
              orderId: createdOrder.id,
              ...line,
            })),
            skipDuplicates: true,
          });

          await tx.quantityLedger.createMany({
            data: buildQuantityLedgerEntries(
              createdOrder.id,
              createdOrder.orderNumber,
              poNumber,
              customerName,
              "ORDER_SENT_TO_FACTORY",
              "website-create",
              productionLines.map((line) => ({
                partNumber: line.partNumber,
                frameNeeded: line.frameNeeded,
                qtyChange: line.quantity,
              }))
            ),
          });
        }

        await applyLeatherInventoryDeltas(tx, leatherInventoryDeltas);
      });
    }

    try {
      await sendOrderNotification({
        type: submitToFactory ? "sent_to_factory" : "created",
        orderNumber: createdOrder.orderNumber,
        poNumber,
        quantity,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        productName: productName || product.name,
        total,
        lineItems,
        selections: selections.map((selection: ResolvedSelection) => ({
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
            orderId: createdOrder.id,
            eventType: submitToFactory
              ? "ORDER_SENT_TO_FACTORY_CUSTOMER"
              : "ORDER_CREATED_CUSTOMER",
            recipient: customerEmail,
            subject: submitToFactory
              ? `Your order was sent to the factory: ${createdOrder.orderNumber}`
              : `We received your order draft: ${createdOrder.orderNumber}`,
            status: "SENT",
          },
          {
            orderId: createdOrder.id,
            eventType: submitToFactory
              ? "ORDER_SENT_TO_FACTORY_INTERNAL"
              : "ORDER_CREATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: submitToFactory
              ? `Order Sent to Factory: ${createdOrder.orderNumber}`
              : `New Order Draft: ${createdOrder.orderNumber}`,
            status: "SENT",
          },
        ],
      });
    } catch (error) {
      console.error("ORDER EMAIL ERROR:", error);

      await prisma.emailLog.create({
        data: {
          orderId: createdOrder.id,
          eventType: submitToFactory ? "ORDER_SENT_TO_FACTORY" : "ORDER_CREATED",
          recipient: customerEmail,
          subject: submitToFactory
            ? `Your order was sent to the factory: ${createdOrder.orderNumber}`
            : `We received your order draft: ${createdOrder.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    if (submitToFactory) {
      try {
        if (parts.length > 0) {
          await appendOrderRow({
            poNumber,
            customerName,
            quantity,
            bodyLeather,
            dateSold: createdAt,
            dueDate,
            parts,
          });
        }

        await prisma.sheetSyncLog.create({
          data: {
            orderId: createdOrder.id,
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
            worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
            spreadsheetRowId: parts.length > 0 ? "APPENDED" : "NO_PART_ROWS",
            status: "SYNCED",
          },
        });
      } catch (error) {
        console.error("ORDER SHEETS ERROR:", error);

        await prisma.sheetSyncLog.create({
          data: {
            orderId: createdOrder.id,
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

    return NextResponse.json(createdOrder, { status: 201 });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 }
    );
  }
}