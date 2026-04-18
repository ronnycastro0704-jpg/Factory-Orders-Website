import Link from "next/link";
import { prisma } from "../../lib/prisma";
import { formatCurrency } from "../../lib/utils";

type OrderCard = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: unknown;
  createdAt: Date;
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

export default async function AdminDashboardPage() {
  const [
    totalOrders,
    sentToFactoryOrders,
    completedOrders,
    activeProducts,
    leatherCount,
    recentOrders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({
      where: { status: "SENT_TO_FACTORY" },
    }),
    prisma.order.count({
      where: { status: "COMPLETED" },
    }),
    prisma.product.count({
      where: { active: true },
    }),
    prisma.leather.count({
      where: { active: true },
    }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        items: {
          select: {
            id: true,
            productNameSnapshot: true,
          },
        },
      },
    }),
  ]);

  const recentOrdersTyped = recentOrders as OrderCard[];

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Dashboard
              </p>

              <h1 className="text-4xl font-bold sm:text-5xl">
                Manage products, orders, leathers, and factory flow.
              </h1>

              <p className="mt-5 max-w-2xl text-base sm:text-lg text-slate-600">
                Review recent activity, manage your catalog, and keep the order
                system clean and easy for both customers and factory workers.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/admin/orders" className="button-primary">
                  View Orders
                </Link>
                <Link href="/admin/products" className="button-secondary">
                  Manage Products
                </Link>
                <Link href="/admin/leathers" className="button-secondary">
                  Manage Leathers
                </Link>
              </div>
            </div>

            <div className="section-card-strong">
              <h2 className="text-2xl font-semibold">Quick Access</h2>
              <div className="mt-5 grid gap-3">
                <Link href="/admin/products" className="premium-grid-card">
                  <p className="text-lg font-semibold">Products</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Add, edit, remove, and organize product options.
                  </p>
                </Link>

                <Link href="/admin/orders" className="premium-grid-card">
                  <p className="text-lg font-semibold">Orders</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Review submitted orders and send them to the factory.
                  </p>
                </Link>

                <Link href="/admin/leathers" className="premium-grid-card">
                  <p className="text-lg font-semibold">Leathers</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Maintain leather library, grades, and images.
                  </p>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{totalOrders}</p>
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

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Active Products
            </p>
            <p className="mt-3 text-4xl font-bold">{activeProducts}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Active Leathers
            </p>
            <p className="mt-3 text-4xl font-bold">{leatherCount}</p>
          </div>
        </section>

        <section className="mt-8 section-card-strong">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Recent Orders
              </p>
              <h2 className="mt-2 text-3xl font-bold">Latest Activity</h2>
            </div>

            <Link href="/admin/orders" className="button-secondary">
              Open Full Orders Page
            </Link>
          </div>

          {recentOrdersTyped.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                No orders yet.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Orders will appear here once customers begin using the builder.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {recentOrdersTyped.map((order: OrderCard) => {
                const firstItem = order.items[0];

                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="premium-grid-card"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="text-lg font-semibold">{order.orderNumber}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {order.customerName}
                        </p>
                        <p className="text-sm text-slate-500">
                          {order.customerEmail}
                        </p>

                        <div className="mt-4 space-y-1 text-sm text-slate-600">
                          <p>
                            Product: {firstItem?.productNameSnapshot || "—"}
                          </p>
                          <p>Created: {formatDate(order.createdAt)}</p>
                        </div>
                      </div>

                      <div className="sm:text-right">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                            order.status
                          )}`}
                        >
                          {order.status.replaceAll("_", " ")}
                        </span>

                        <p className="mt-4 text-2xl font-bold text-slate-900">
                          {formatCurrency(Number(order.total))}
                        </p>
                      </div>
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