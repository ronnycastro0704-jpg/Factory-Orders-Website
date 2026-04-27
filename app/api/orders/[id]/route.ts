import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { sendOrderNotification } from "../../../../lib/email";
import { getApprovedCustomerProfile } from "../../../../lib/approved-customer";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

type RevisionSelectionSnapshot = {
  selections: IncomingSelection[];
  quantity: number;
};

type LeatherInventoryDelta = {
  leatherName: string;
  units: number;
};

const SELECTION_META_SEPARATOR = "|||";
const ORDER_PRIORITIES = new Set<OrderPriority>(["NORMAL", "RUSH", "HOLD"]);

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}


function isAdminEmail(email?: string | null) {
  if (!email) return false;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizePriority(
  value: unknown,
  fallback: OrderPriority
): OrderPriority {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "HOT") {
    return "HOLD";
  }

  if (ORDER_PRIORITIES.has(raw as OrderPriority)) {
    return raw as OrderPriority;
  }

  return fallback;
}

function parseOptionalDate(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) {
    return { raw, date: null as Date | null };
  }

  const date = new Date(raw);

  return {
    raw,
    date: Number.isNaN(date.getTime()) ? null : date,
  };
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
    priceDeltaSnapshot: number;
    leatherInventoryUsageSnapshot: number | null;
  }> = [];

  for (const selection of selections) {
    rows.push({
      optionGroupNameSnapshot: selection.groupName,
      optionChoiceNameSnapshot: selection.choiceLabel,
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
        priceDeltaSnapshot: Number(selection.leatherSurcharge || 0),
        leatherInventoryUsageSnapshot: null,
      });
    }

    if (selection.laseredBrand) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}Yes`,
        priceDeltaSnapshot: 0,
        leatherInventoryUsageSnapshot: null,
      });
    }

    if (selection.laseredBrandImageUrl) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand Image`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.laseredBrandImageUrl}`,
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

function buildLeatherInventoryDiff(
  previousDeltas: LeatherInventoryDelta[],
  nextDeltas: LeatherInventoryDelta[]
): LeatherInventoryDelta[] {
  const grouped = new Map<string, number>();

  for (const delta of previousDeltas) {
    grouped.set(
      delta.leatherName,
      roundToTwo((grouped.get(delta.leatherName) || 0) - delta.units)
    );
  }

  for (const delta of nextDeltas) {
    grouped.set(
      delta.leatherName,
      roundToTwo((grouped.get(delta.leatherName) || 0) + delta.units)
    );
  }

  return Array.from(grouped.entries())
    .filter(([, units]) => units !== 0)
    .map(([leatherName, units]) => ({
      leatherName,
      units,
    }));
}

async function applyLeatherInventoryDeltas(
  tx: Prisma.TransactionClient,
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

function extractLatestRevisionSnapshot(afterJson: unknown): RevisionSelectionSnapshot {
  if (!afterJson || typeof afterJson !== "object") {
    return {
      selections: [],
      quantity: 1,
    };
  }

  const parsed = afterJson as {
    selections?: unknown;
    quantity?: unknown;
  };

  const quantity = sanitizeQuantity(
    typeof parsed.quantity === "number"
      ? parsed.quantity
      : Number(parsed.quantity ?? 1)
  );

  if (!Array.isArray(parsed.selections)) {
    return {
      selections: [],
      quantity,
    };
  }

  const selections = parsed.selections
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const selection = item as IncomingSelection;

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
          typeof selection.choiceValue === "string" ? selection.choiceValue : null,
        partNumber:
          typeof selection.partNumber === "string" ? selection.partNumber : null,
        leatherName:
          typeof selection.leatherName === "string" ? selection.leatherName : null,
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
        leatherInventoryUsage: Number(selection.leatherInventoryUsage || 0),
      } satisfies IncomingSelection;
    })
    .filter(Boolean) as IncomingSelection[];

  return {
    selections,
    quantity,
  };
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const viewerEmail = normalizeEmail(session.user.email);
    const { id } = await context.params;

    const viewerUser = await prisma.user.findUnique({
      where: { email: viewerEmail },
      select: { id: true },
    });

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
        productionLines: {
          orderBy: [{ partNumber: "asc" }, { frameNeeded: "asc" }],
        },
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isSubmitter =
      Boolean(order.userId) &&
      Boolean(viewerUser?.id) &&
      order.userId === viewerUser?.id;

    const isCustomer = normalizeEmail(order.customerEmail) === viewerEmail;

    const allowed = isSubmitter || isCustomer || isAdminEmail(viewerEmail);

    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to view this order." },
        { status: 403 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch order." },
      { status: 500 }
    );
  }
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to edit an order." },
        { status: 401 }
      );
    }

    const viewerEmail = normalizeEmail(session.user.email);
    const viewerUser = await prisma.user.findUnique({
      where: { email: viewerEmail },
      select: { id: true },
    });

    const { id } = await context.params;
    const body = await request.json();

    const poNumber = String(body.poNumber || "").trim() || null;
    const customerPhone = String(body.customerPhone || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const changeReason = String(body.changeReason || "").trim() || "Order updated";
    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);

    const rawSelections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];


    if (rawSelections.length === 0) {
      return NextResponse.json(
        { error: "At least one selection is required." },
        { status: 400 }
      );
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
        productionLines: true,
      },
    });

    if (!order || order.items.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isSubmitter =
      Boolean(order.userId) &&
      Boolean(viewerUser?.id) &&
      order.userId === viewerUser?.id;

    const isCustomer = normalizeEmail(order.customerEmail) === viewerEmail;

    const allowed = isSubmitter || isCustomer || isAdminEmail(viewerEmail);

    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to edit this order." },
        { status: 403 }
      );
    }

    const approvedCustomer = await getApprovedCustomerProfile(viewerEmail);

    if (isCustomer && !approvedCustomer) {
      return NextResponse.json(
        { error: "This email is not approved to edit customer orders." },
        { status: 403 }
      );
    }

    const customerName = order.customerName;
    const customerEmail = normalizeEmail(order.customerEmail);

    const item = order.items[0];

    const quantity = sanitizeQuantity(
      Number(
        body.quantity ??
          body.orderQuantity ??
          body.selections?.[0]?.quantity ??
          order.quantity ??
          1
      )
    );
    const priority = normalizePriority(body.priority, order.priority as OrderPriority);
    const dueDateInput = parseOptionalDate(body.dueDate);
    const dueDate = dueDateInput.raw === "" ? order.dueDate : dueDateInput.date;

    if (dueDateInput.raw && !dueDateInput.date) {
      return NextResponse.json(
        { error: "Due date is invalid." },
        { status: 400 }
      );
    }

    const selections = await enrichSelectionsWithLeatherUsage(
      item.productId,
      rawSelections
    );

    const selectionRows = buildSelectionRows(selections);
    const nextRevisionNumber =
      order.revisions.length > 0 ? order.revisions[0].revisionNumber + 1 : 1;
    const nextStatus = order.status === "DRAFT" ? "DRAFT" : "CHANGED";
    const bodyLeather = buildBodyLeather(selections) || null;
    const nextProductionLines = buildProductionLines(
      selections,
      productName || item.productNameSnapshot,
      quantity,
      bodyLeather,
      dueDate,
      priority
    );

    const previousRevisionSnapshot = extractLatestRevisionSnapshot(
      order.revisions[0]?.afterJson
    );
    const previousSelections = await enrichSelectionsWithLeatherUsage(
      item.productId,
      previousRevisionSnapshot.selections
    );

    const shouldAdjustLeatherInventory =
      order.status === "SENT_TO_FACTORY" ||
      order.status === "COMPLETED" ||
      order.productionLines.length > 0;

    const previousLeatherInventoryDeltas = shouldAdjustLeatherInventory
      ? buildLeatherInventoryDeltas(
          previousSelections,
          previousRevisionSnapshot.quantity || order.quantity
        )
      : [];

    const nextLeatherInventoryDeltas = shouldAdjustLeatherInventory
      ? buildLeatherInventoryDeltas(selections, quantity)
      : [];

    const leatherInventoryDiff = shouldAdjustLeatherInventory
      ? buildLeatherInventoryDiff(
          previousLeatherInventoryDeltas,
          nextLeatherInventoryDeltas
        )
      : [];

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: {
          poNumber,
          customerName,
          customerEmail,
          customerPhone,
          notes,
          total,
          subtotal: total,
          quantity,
          dueDate,
          priority,
          status: nextStatus,
          items: {
            update: {
              where: { id: item.id },
              data: {
                productNameSnapshot: productName || item.productNameSnapshot,
                basePriceSnapshot: basePrice,
                quantity,
                lineTotal: total,
                selections: {
                  deleteMany: {},
                  create: selectionRows,
                },
              },
            },
          },
        },
      }),
      prisma.orderRevision.create({
        data: {
          orderId: id,
          revisionNumber: nextRevisionNumber,
          changedBy: viewerEmail,
          changeReason,
          beforeJson: {
            status: order.status,
            poNumber: order.poNumber,
            quantity: order.quantity,
            priority: order.priority,
            dueDate: order.dueDate,
          },
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
      }),
    ]);

    if (order.productionLines.length > 0) {
      const previousMap = new Map(
        order.productionLines.map((line) => [
          `${line.partNumber}|||${line.frameNeeded}`,
          line,
        ])
      );
      const nextMap = new Map(
        nextProductionLines.map((line) => [
          `${line.partNumber}|||${line.frameNeeded}`,
          line,
        ])
      );

      const ledgerChanges: Array<{
        partNumber: string;
        frameNeeded: string;
        qtyChange: number;
      }> = [];

      const tx: Prisma.PrismaPromise<unknown>[] = [];

      for (const previousLine of order.productionLines) {
        const key = `${previousLine.partNumber}|||${previousLine.frameNeeded}`;

        if (!nextMap.has(key)) {
          tx.push(
            prisma.productionLine.delete({
              where: { id: previousLine.id },
            })
          );

          ledgerChanges.push({
            partNumber: previousLine.partNumber,
            frameNeeded: previousLine.frameNeeded,
            qtyChange: -previousLine.quantity,
          });
        }
      }

      for (const nextLine of nextProductionLines) {
        const key = `${nextLine.partNumber}|||${nextLine.frameNeeded}`;
        const previousLine = previousMap.get(key);

        if (!previousLine) {
          tx.push(
            prisma.productionLine.create({
              data: {
                orderId: id,
                ...nextLine,
              },
            })
          );

          ledgerChanges.push({
            partNumber: nextLine.partNumber,
            frameNeeded: nextLine.frameNeeded,
            qtyChange: nextLine.quantity,
          });

          continue;
        }

        tx.push(
          prisma.productionLine.update({
            where: { id: previousLine.id },
            data: {
              productNameSnapshot: nextLine.productNameSnapshot,
              optionGroupNameSnapshot: nextLine.optionGroupNameSnapshot,
              optionChoiceNameSnapshot: nextLine.optionChoiceNameSnapshot,
              quantity: nextLine.quantity,
              bodyLeather: nextLine.bodyLeather,
              dueDate: nextLine.dueDate,
              priority: nextLine.priority,
            },
          })
        );

        const diff = nextLine.quantity - previousLine.quantity;

        if (diff !== 0) {
          ledgerChanges.push({
            partNumber: nextLine.partNumber,
            frameNeeded: nextLine.frameNeeded,
            qtyChange: diff,
          });
        }
      }

      if (ledgerChanges.length > 0) {
        tx.push(
          prisma.quantityLedger.createMany({
            data: ledgerChanges.map((change) => ({
              orderId: id,
              orderNumber: order.orderNumber,
              poNumber,
              customerName,
              partNumber: change.partNumber,
              frameNeeded: change.frameNeeded,
              qtyChange: change.qtyChange,
              reason: "ORDER_EDITED",
              source: "website-edit",
            })),
          })
        );
      }

      if (tx.length > 0) {
        await prisma.$transaction(tx);
      }
    }

    if (shouldAdjustLeatherInventory && leatherInventoryDiff.length > 0) {
      await prisma.$transaction(async (tx) => {
        await applyLeatherInventoryDeltas(tx, leatherInventoryDiff);
      });
    }

    try {
      await sendOrderNotification({
        type: "updated",
        orderNumber: order.orderNumber,
        poNumber,
        quantity,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        productName: productName || item.productNameSnapshot,
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
            orderId: id,
            eventType: "ORDER_UPDATED_CUSTOMER",
            recipient: customerEmail,
            subject: `Your order was updated: ${order.orderNumber}`,
            status: "SENT",
          },
          {
            orderId: id,
            eventType: "ORDER_UPDATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: `Order Updated: ${order.orderNumber}`,
            status: "SENT",
          },
        ],
      });
    } catch (error) {
      console.error("UPDATE ORDER EMAIL ERROR:", error);

      await prisma.emailLog.create({
        data: {
          orderId: id,
          eventType: "ORDER_UPDATED",
          recipient: customerEmail,
          subject: `Your order was updated: ${order.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
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
        productionLines: {
          orderBy: [{ partNumber: "asc" }, { frameNeeded: "asc" }],
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