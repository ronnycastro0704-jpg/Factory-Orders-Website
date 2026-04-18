import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  status: string;
  total: unknown;
  notes: string | null;
  createdAt: Date;
  items: {
    id: string;
    productNameSnapshot: string;
    lineTotal: unknown;
    selections: {
      id: string;
      optionGroupNameSnapshot: string;
      optionChoiceNameSnapshot: string;
    }[];
  }[];
  emailLogs: {
    id: string;
    status: string;
    recipient: string;
    createdAt: Date;
  }[];
  sheetSyncLogs: {
    id: string;
    status: string;
    worksheetName: string | null;
    createdAt: Date;
  }[];
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClasses(status: string) {
  switch (status) {
    case "SENT_TO_FACTORY":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-200";
    case "CHANGED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "DRAFT":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-white text-slate-700 border-slate-200";
  }
}

export default async function AdminOrdersPage() {
  const [totalOrders, draftOrders, sentToFactoryOrders, completedOrders, orders] =
    await Promise.all([
      prisma.order.count(),
      prisma.order.count({
        where: { status: "DRAFT" },
      }),
      prisma.order.count({
        where: { status: "SENT_TO_FACTORY" },
      }),
      prisma.order.count({
        where: { status: "COMPLETED" },
      }),
      prisma.order.findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          items: {
            include: {
              selections: true,
            },
          },
          emailLogs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
          sheetSyncLogs: {
            orderBy: { createdAt: "desc" },
            take: 1,
          },
        },
      }),
    ]);

  const typedOrders = orders as OrderRow[];

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Orders
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                Track orders and factory status
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Review incoming customer orders, open details, and monitor email
                and sheet sync activity.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/products" className="button-secondary">
                Products
              </Link>
              <Link href="/admin/leathers" className="button-secondary">
                Leathers
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{totalOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Drafts
            </p>
            <p className="mt-3 text-4xl font-bold">{draftOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Sent to Factory
            </p>
            <p className="mt-3 text-4xl font-bold">{sentToFactoryOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Completed
            </p>
            <p className="mt-3 text-4xl font-bold">{completedOrders}</p>
          </div>
        </section>

        <section className="mt-8 section-card-strong">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Orders
              </p>
              <h2 className="mt-2 text-3xl font-bold">Latest 50 Orders</h2>
            </div>

            <span className="status-pill">
              Sorted newest to oldest
            </span>
          </div>

          {typedOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                No orders found.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Orders will appear here once customers start submitting them.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {typedOrders.map((order: OrderRow) => {
                const firstItem = order.items[0];
                const latestEmail = order.emailLogs[0];
                const latestSheet = order.sheetSyncLogs[0];
                const selectionCount = order.items.reduce(
                  (sum, item) => sum + item.selections.length,
                  0
                );

                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="premium-grid-card"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold">
                              {order.orderNumber}
                            </p>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                order.status
                              )}`}
                            >
                              {order.status.replaceAll("_", " ")}
                            </span>
                          </div>

                          <p className="mt-2 text-sm text-slate-500">
                            {order.customerName}
                          </p>
                          <p className="text-sm text-slate-500">
                            {order.customerEmail}
                          </p>
                          {order.customerPhone ? (
                            <p className="text-sm text-slate-500">
                              {order.customerPhone}
                            </p>
                          ) : null}
                        </div>

                        <div className="sm:text-right">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Total
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {formatCurrency(Number(order.total))}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2">
                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Product
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {firstItem?.productNameSnapshot || "—"}
                          </p>
                        </div>

                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Selections
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {selectionCount}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Created
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Latest Email
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {latestEmail
                              ? `${latestEmail.status} → ${latestEmail.recipient}`
                              : "No email logs"}
                          </p>
                        </div>

                        <div>
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Latest Sheet Sync
                          </p>
                          <p className="mt-1 text-sm text-slate-700">
                            {latestSheet
                              ? `${latestSheet.status} · ${
                                  latestSheet.worksheetName || "Orders"
                                }`
                              : "No sheet logs"}
                          </p>
                        </div>
                      </div>

                      {order.notes ? (
                        <div className="rounded-xl border bg-white/80 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Notes
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {order.notes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}