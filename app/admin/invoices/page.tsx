import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";
import InvoiceBuilder from "./invoice-builder";

type AvailableOrder = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  adminSubmitted: boolean;
  status: string;
  overallProductionStatus: string;
  quantity: number;
  total: number;
  productSummary: string;
  createdAt: string;
};

type RecentInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: number;
  dueAt: string;
  createdAt: string;
  orderCount: number;
};

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

function serializeAvailableOrder(order: {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  status: string;
  overallProductionStatus: string;
  quantity: number;
  total: unknown;
  createdAt: Date;
  user: {
    email: string;
  } | null;
  items: {
    productNameSnapshot: string;
  }[];
}): AvailableOrder {
return {
  id: order.id,
  orderNumber: order.orderNumber,
  poNumber: order.poNumber,
  customerName: order.customerName,
  customerEmail: order.customerEmail,
  adminSubmitted:
    isAdminEmail(order.user?.email) || isAdminEmail(order.customerEmail),
  status: order.status,
  overallProductionStatus: order.overallProductionStatus,
  quantity: order.quantity,
  total: Number(order.total || 0),
  productSummary: buildProductSummary(order),
  createdAt: order.createdAt.toISOString(),
};
}

function serializeRecentInvoice(invoice: {
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
  }[];
}): RecentInvoice {
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
  };
}

export default async function AdminInvoicesPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

let availableOrders: AvailableOrder[] = [];
let recentInvoices: RecentInvoice[] = [];
let invoicePageError = "";

try {
    const debugCounts = await prisma.order.groupBy({
  by: ["status"],
  _count: {
    _all: true,
  },
});

const completedOrPaidCount = await prisma.order.count({
  where: {
    status: {
      in: ["COMPLETED", "PAID"],
    },
  },
});

const completedOrPaidUninvoicedCount = await prisma.order.count({
  where: {
    status: {
      in: ["COMPLETED", "PAID"],
    },
    invoiceOrders: {
      none: {
        invoice: {
          status: {
            not: "VOID",
          },
        },
      },
    },
  },
});

const completedOrPaidOrdersDebug = await prisma.order.findMany({
  where: {
    status: {
      in: ["COMPLETED", "PAID"],
    },
  },
  take: 10,
  orderBy: {
    createdAt: "desc",
  },
  select: {
    orderNumber: true,
    poNumber: true,
    status: true,
    overallProductionStatus: true,
    customerEmail: true,
    invoiceOrders: {
      select: {
        invoice: {
          select: {
            invoiceNumber: true,
            status: true,
          },
        },
      },
    },
  },
});

console.log("INVOICE DEBUG status counts:", debugCounts);
console.log("INVOICE DEBUG completed/paid count:", completedOrPaidCount);
console.log(
  "INVOICE DEBUG completed/paid uninvoiced count:",
  completedOrPaidUninvoicedCount
);
console.log(
  "INVOICE DEBUG sample completed/paid orders:",
  completedOrPaidOrdersDebug
);
  const [orders, invoices] = await Promise.all([
    prisma.order.findMany({
      where: {
        status: {
          in: ["COMPLETED", "PAID"],
        },
        invoiceOrders: {
          none: {
            invoice: {
              status: {
                not: "VOID",
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
      select: {
        id: true,
        orderNumber: true,
        poNumber: true,
        customerName: true,
        customerEmail: true,
        status: true,
        overallProductionStatus: true,
        quantity: true,
        total: true,
          user: {
    select: {
      email: true,
    },
  },
        createdAt: true,
        items: {
          select: {
            productNameSnapshot: true,
          },
        },
      },
    }),

    prisma.invoice.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 25,
      include: {
        orders: {
          select: {
            id: true,
          },
        },
      },
    }),
  ]);

  availableOrders = orders.map(serializeAvailableOrder);
  recentInvoices = invoices.map(serializeRecentInvoice);
} catch (error) {
  console.error("ADMIN INVOICES PAGE ERROR:", error);
  invoicePageError =
    "Invoices could not load. The production database may need the latest Prisma migration.";
}

  const availableTotal = availableOrders.reduce(
    (sum, order) => sum + order.total,
    0
  );

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Invoices
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                Build invoices from completed orders
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Drag two or more completed orders into an invoice draft, verify
                the customer, and create a grouped invoice with PO numbers,
                items, and due upon receipt terms.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/orders" className="button-secondary">
                Orders
              </Link>
              <Link href="/admin/production" className="button-secondary">
                Production
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Available Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{availableOrders.length}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Available Value
            </p>
            <p className="mt-3 text-4xl font-bold">
              {formatCurrency(availableTotal)}
            </p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Recent Invoices
            </p>
            <p className="mt-3 text-4xl font-bold">{recentInvoices.length}</p>
          </div>
        </section>

        {invoicePageError ? (
  <section className="section-card-strong border-red-200 bg-red-50 text-red-700">
    <h2 className="text-xl font-bold">Invoices could not load</h2>
    <p className="mt-2 text-sm">{invoicePageError}</p>
  </section>
) : (
  <InvoiceBuilder
    availableOrders={availableOrders}
    recentInvoices={recentInvoices}
  />
)}
 
      </div>
    </main>
  );
}