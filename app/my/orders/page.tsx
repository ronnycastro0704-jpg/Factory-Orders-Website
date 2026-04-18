import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";

type OrderRow = {
  id: string;
  orderNumber: string;
  status: string;
  total: unknown;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productNameSnapshot: string;
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

export default async function MyOrdersPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const userEmail = session.user.email.toLowerCase();

  const orders = (await prisma.order.findMany({
    where: {
      customerEmail: userEmail,
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
        },
      },
    },
  })) as OrderRow[];

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                My Orders
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                Review your submitted and draft orders
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Open any order to review changes, continue editing drafts, and
                keep track of what has already been sent to the factory.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="button-secondary">
                ← Back to Products
              </Link>
            </div>
          </div>
        </section>

        <section className="section-card-strong">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Orders
              </p>
              <h2 className="mt-2 text-3xl font-bold">Your Order History</h2>
            </div>

            <span className="status-pill">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                You do not have any orders yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Go back to the product page and create your first order.
              </p>
              <div className="mt-6">
                <Link href="/" className="button-primary">
                  Browse Products
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {orders.map((order: OrderRow) => {
                const firstItem = order.items[0];

                return (
                  <div key={order.id} className="premium-grid-card">
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

                          <p className="mt-3 text-sm text-slate-600">
                            Product: {firstItem?.productNameSnapshot || "—"}
                          </p>
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
                            Created
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            {formatDate(order.createdAt)}
                          </p>
                        </div>

                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Last Updated
                          </p>
                          <p className="mt-2 text-sm text-slate-700">
                            {formatDate(order.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Link
                          href={`/orders/${order.id}/edit`}
                          className="button-primary"
                        >
                          Open Order
                        </Link>

                        {order.status === "DRAFT" || order.status === "CHANGED" ? (
                          <Link
                            href={`/orders/${order.id}/edit`}
                            className="button-secondary"
                          >
                            Continue Editing
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}