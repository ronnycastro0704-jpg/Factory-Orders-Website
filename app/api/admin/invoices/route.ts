import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

function generateInvoiceNumber() {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `INV-${yyyy}${mm}${dd}-${suffix}`;
}

function cleanChoiceLabel(value: string) {
  return value.replaceAll("|||", " — ");
}

function normalizeMoney(value: unknown) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function buildProductSummary(order: {
  items: {
    productNameSnapshot: string;
  }[];
}) {
  const names = Array.from(
    new Set(order.items.map((item) => item.productNameSnapshot).filter(Boolean))
  );

  return names.join(", ") || "Order";
}

function buildItemSummary(order: {
  items: {
    productNameSnapshot: string;
    quantity: number;
    lineTotal: Prisma.Decimal;
    basePriceSnapshot: Prisma.Decimal;
    selections: {
      optionGroupNameSnapshot: string;
      optionChoiceNameSnapshot: string;
      leatherNameSnapshot: string | null;
      leatherGradeSnapshot: string | null;
      priceDeltaSnapshot: Prisma.Decimal;
    }[];
  }[];
}) {
  return order.items.map((item) => ({
    productName: item.productNameSnapshot,
    quantity: item.quantity,
    basePrice: Number(item.basePriceSnapshot),
    lineTotal: Number(item.lineTotal),
    selections: item.selections.map((selection) => ({
      groupName: selection.optionGroupNameSnapshot,
      choiceLabel: cleanChoiceLabel(selection.optionChoiceNameSnapshot),
      leatherName: selection.leatherNameSnapshot,
      leatherGrade: selection.leatherGradeSnapshot,
      amount: Number(selection.priceDeltaSnapshot),
    })),
  }));
}

function normalizeOrderIds(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => String(item || "").trim())
        .filter(Boolean)
    )
  );
}

export async function GET() {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const invoices = await prisma.invoice.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      include: {
        orders: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(invoices);
  } catch (error) {
    console.error("LIST INVOICES ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load invoices." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const body = await request.json();
    const orderIds = normalizeOrderIds(body.orderIds);
    const notes = String(body.notes || "").trim() || null;
    const surchargeAmount = normalizeMoney(body.surchargeAmount);
const surchargeLabel =
  String(body.surchargeLabel || "").trim() ||
  (surchargeAmount > 0 ? "Tax / tariff surcharge" : null);

if (orderIds.length < 1) {
  return NextResponse.json(
    { error: "Please select at least one order for an invoice." },
    { status: 400 }
  );
}

    const orders = await prisma.order.findMany({
      where: {
        id: {
          in: orderIds,
        },
      },
      include: {
        invoiceOrders: {
          include: {
            invoice: true,
          },
        },
        items: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            selections: {
              orderBy: {
                createdAt: "asc",
              },
            },
          },
        },
      },
    });

    if (orders.length !== orderIds.length) {
      return NextResponse.json(
        { error: "One or more selected orders could not be found." },
        { status: 404 }
      );
    }

    const customerEmails = Array.from(
      new Set(orders.map((order) => order.customerEmail.trim().toLowerCase()))
    );

    if (customerEmails.length !== 1) {
      return NextResponse.json(
        {
          error:
            "All selected orders must belong to the same customer email before creating one invoice.",
        },
        { status: 400 }
      );
    }

    const alreadyInvoicedOrders = orders.filter((order) =>
      order.invoiceOrders.some(
        (invoiceOrder) => invoiceOrder.invoice.status !== "VOID"
      )
    );

    if (alreadyInvoicedOrders.length > 0) {
      return NextResponse.json(
        {
          error: `These orders are already on a non-void invoice: ${alreadyInvoicedOrders
            .map((order) => order.orderNumber)
            .join(", ")}`,
        },
        { status: 400 }
      );
    }

    const invoiceNumber = generateInvoiceNumber();
const invoiceSubtotal = orders.reduce(
  (sum, order) => sum + Number(order.total || 0),
  0
);

const invoiceTotal = invoiceSubtotal + surchargeAmount;

    const firstOrder = orders[0];

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerName: firstOrder.customerName,
        customerEmail: firstOrder.customerEmail,
subtotal: invoiceSubtotal,
surchargeLabel,
surchargeAmount,
total: invoiceTotal,
terms: "Due upon receipt",
        issuedAt: new Date(),
        dueAt: new Date(),
        notes,
        createdByEmail: session.user.email,
        orders: {
          create: orders.map((order) => ({
            orderId: order.id,
            orderNumber: order.orderNumber,
            poNumber: order.poNumber,
            customerName: order.customerName,
            customerEmail: order.customerEmail,
            productSummary: buildProductSummary(order),
            itemSummary: buildItemSummary(order),
            quantity: order.quantity,
            orderTotal: Number(order.total || 0),
          })),
        },
      },
      include: {
        orders: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("CREATE INVOICE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create invoice." },
      { status: 500 }
    );
  }
}