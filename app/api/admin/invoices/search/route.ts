import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";

type SearchInvoiceResult = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: number;
  dueAt: string;
  createdAt: string;
  orderCount: number;
  orderNumbers: string[];
  poNumbers: string[];
};

const INVOICE_STATUSES = ["DRAFT", "ISSUED", "PAID", "VOID"] as const;

function serializeInvoice(invoice: {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: unknown;
  dueAt: Date;
  createdAt: Date;
  orders: {
    id: string;
    orderNumber: string;
    poNumber: string | null;
  }[];
}): SearchInvoiceResult {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    status: invoice.status,
    total: Number(invoice.total || 0),
    dueAt: invoice.dueAt.toISOString(),
    createdAt: invoice.createdAt.toISOString(),
    orderCount: invoice.orders.length,
    orderNumbers: invoice.orders.map((order) => order.orderNumber),
    poNumbers: invoice.orders
      .map((order) => order.poNumber)
      .filter(Boolean) as string[],
  };
}

export async function GET(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const query = String(searchParams.get("q") || "").trim();
    const normalizedQuery = query.toLowerCase();
    const upperQuery = query.toUpperCase().replaceAll(" ", "_");

    const matchedStatuses = INVOICE_STATUSES.filter((status) =>
      status.includes(upperQuery)
    );

    const totalSearchValue = Number(query.replace(/[^0-9.-]/g, ""));
    const hasTotalSearch =
      Number.isFinite(totalSearchValue) && query.replace(/[^0-9]/g, "").length > 0;

    const where: Prisma.InvoiceWhereInput = query
      ? {
          OR: [
            {
              invoiceNumber: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              customerName: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              customerEmail: {
                contains: query,
                mode: "insensitive",
              },
            },
            {
              orders: {
                some: {
                  orderNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              orders: {
                some: {
                  poNumber: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
            {
              orders: {
                some: {
                  productSummary: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
            ...matchedStatuses.map((status) => ({
              status,
            })),
            ...(hasTotalSearch
              ? [
                  {
                    total: new Prisma.Decimal(totalSearchValue),
                  },
                ]
              : []),
          ],
        }
      : {};

    const invoices = await prisma.invoice.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: query ? 100 : 25,
      include: {
        orders: {
          select: {
            id: true,
            orderNumber: true,
            poNumber: true,
          },
        },
      },
    });

    return NextResponse.json({
      invoices: invoices.map(serializeInvoice),
    });
  } catch (error) {
    console.error("SEARCH INVOICES ERROR:", error);

    return NextResponse.json(
      { error: "Failed to search invoices." },
      { status: 500 }
    );
  }
}