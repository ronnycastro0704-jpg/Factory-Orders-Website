import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { sendOrderNotification } from "../../../../lib/email";
import { appendQuantityLedgerRows } from "../../../../lib/sheets";


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

const SELECTION_META_SEPARATOR = "|||";
const ORDER_PRIORITIES = new Set<OrderPriority>(["NORMAL", "RUSH", "HOLD"]);

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

function normalizePriority(value: unknown, fallback: OrderPriority): OrderPriority {
  const raw = String(value || "")
    .trim()
    .toUpperCase();

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

function buildSelectionRows(selections: IncomingSelection[]) {
  return selections.flatMap((selection: IncomingSelection) => {
    const rows = [
      {
        optionGroupNameSnapshot: selection.groupName,
        optionChoiceNameSnapshot: selection.choiceLabel,
        priceDeltaSnapshot: Number(selection.baseAmount || 0),
      },
    ];

    if (selection.leatherName) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Leather`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.leatherName}${
          selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
        }`,
        priceDeltaSnapshot: Number(selection.leatherSurcharge || 0),
      });
    }

    if (selection.laseredBrand) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}Yes`,
        priceDeltaSnapshot: 0,
      });
    }

    if (selection.laseredBrandImageUrl) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand Image`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.laseredBrandImageUrl}`,
        priceDeltaSnapshot: 0,
      });
    }

    return rows;
  });
}

function buildBodyLeather(selections: IncomingSelection[]) {
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
  selections: IncomingSelection[],
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
    const customerName = String(body.customerName || "").trim();
    const customerEmailRaw = String(body.customerEmail || "").trim();
    const customerEmail = normalizeEmail(customerEmailRaw);
    const customerPhone = String(body.customerPhone || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const changeReason = String(body.changeReason || "").trim() || "Order updated";
    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!customerEmail || !isValidEmail(customerEmail)) {
      return NextResponse.json(
        { error: "A valid customer email is required." },
        { status: 400 }
      );
    }

    if (selections.length === 0) {
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

    const quantity = sanitizeQuantity(
      Number(body.quantity ?? body.orderQuantity ?? body.selections?.[0]?.quantity ?? order.quantity ?? 1)
    );
    const priority = normalizePriority(body.priority, order.priority as OrderPriority);
    const dueDateInput = parseOptionalDate(body.dueDate);
    const dueDate =
      dueDateInput.raw === ""
        ? order.dueDate
        : dueDateInput.date;

    if (dueDateInput.raw && !dueDateInput.date) {
      return NextResponse.json(
        { error: "Due date is invalid." },
        { status: 400 }
      );
    }

    const item = order.items[0];
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

    const [updatedOrder] = await prisma.$transaction([
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
          productionLines: true,
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
              orderNumber: updatedOrder.orderNumber,
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

      if (ledgerChanges.length > 0) {
        try {
          await appendQuantityLedgerRows({
            orderNumber: updatedOrder.orderNumber,
            poNumber,
            customerName,
            reason: "ORDER_EDITED",
            source: "website-edit",
            parts: ledgerChanges,
          });

          await prisma.sheetSyncLog.create({
            data: {
              orderId: id,
              spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
              worksheetName:
                process.env.GOOGLE_SHEETS_QUANTITY_LEDGER_TAB_NAME ||
                "Quantity Ledger",
              spreadsheetRowId: "APPENDED",
              status: "SYNCED",
            },
          });
        } catch (error) {
          console.error("UPDATE QUANTITY LEDGER SHEETS ERROR:", error);

          await prisma.sheetSyncLog.create({
            data: {
              orderId: id,
              spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
              worksheetName:
                process.env.GOOGLE_SHEETS_QUANTITY_LEDGER_TAB_NAME ||
                "Quantity Ledger",
              spreadsheetRowId: "APPEND_FAILED",
              status: "FAILED",
              errorMessage:
                error instanceof Error ? error.message : "Unknown sheets error",
            },
          });
        }
      }
    }

    try {
      await sendOrderNotification({
        type: "updated",
        orderNumber: updatedOrder.orderNumber,
        poNumber,
        quantity,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        productName: productName || item.productNameSnapshot,
        total,
        lineItems,
        selections: selections.map((selection: IncomingSelection) => ({
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
            subject: `Your order was updated: ${updatedOrder.orderNumber}`,
            status: "SENT",
          },
          {
            orderId: id,
            eventType: "ORDER_UPDATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: `Order Updated: ${updatedOrder.orderNumber}`,
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
          subject: `Your order was updated: ${updatedOrder.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 }
    );
  }
}