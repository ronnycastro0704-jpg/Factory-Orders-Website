import Link from "next/link";
import { prisma } from "../../lib/prisma";

type RecentOrderItem = {
  id: string;
  productNameSnapshot: string;
};

type RecentOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  items: RecentOrderItem[];
};

export default async function AdminDashboardPage() {
  const [
    totalOrders,
    draftOrders,
    changedOrders,
    sentOrders,
    completedOrders,
    failedEmails,
    failedSheets,
    recentOrdersRaw,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "DRAFT" } }),
    prisma.order.count({ where: { status: "CHANGED" } }),
    prisma.order.count({ where: { status: "SENT_TO_FACTORY" } }),
    prisma.order.count({ where: { status: "COMPLETED" } }),
    prisma.emailLog.count({ where: { status: "FAILED" } }),
    prisma.sheetSyncLog.count({ where: { status: "FAILED" } }),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      include: {
        items: true,
      },
    }),
  ]);

  const recentOrders = recentOrdersRaw as RecentOrder[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm text-slate-500">Admin</p>
          <h1 className="text-4xl font-bold">Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Monitor orders, failures, and factory flow at a glance.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Link
            href="/admin/orders"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Total Orders</p>
            <p className="mt-2 text-3xl font-bold">{totalOrders}</p>
          </Link>

          <Link
            href="/admin/orders?status=CHANGED"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Changed</p>
            <p className="mt-2 text-3xl font-bold">{changedOrders}</p>
          </Link>

          <Link
            href="/admin/orders?status=SENT_TO_FACTORY"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Sent to Factory</p>
            <p className="mt-2 text-3xl font-bold">{sentOrders}</p>
          </Link>

          <Link
            href="/admin/orders?status=COMPLETED"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Completed</p>
            <p className="mt-2 text-3xl font-bold">{completedOrders}</p>
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Link
            href="/admin/orders?status=DRAFT"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Draft</p>
            <p className="mt-2 text-3xl font-bold">{draftOrders}</p>
          </Link>

          <Link
            href="/admin/orders?emailStatus=FAILED"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Failed Emails</p>
            <p className="mt-2 text-3xl font-bold">{failedEmails}</p>
          </Link>

          <Link
            href="/admin/orders?sheetStatus=FAILED"
            className="rounded-2xl border bg-white p-5 shadow-sm transition hover:bg-slate-50"
          >
            <p className="text-sm text-slate-500">Failed Sheets Sync</p>
            <p className="mt-2 text-3xl font-bold">{failedSheets}</p>
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Recent Orders</h2>
            <Link
              href="/admin/orders"
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              View all
            </Link>
          </div>

          <div className="space-y-4">
            {recentOrders.length === 0 ? (
              <p className="text-slate-500">No orders yet.</p>
            ) : (
              recentOrders.map((order: RecentOrder) => (
                <div
                  key={order.id}
                  className="rounded-xl border p-4 transition hover:bg-slate-50"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-lg font-semibold">{order.orderNumber}</p>
                      <p className="text-sm text-slate-500">
                        {order.customerName} • {order.customerEmail}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        {order.items[0]?.productNameSnapshot || "No product"} •{" "}
                        {order.status}
                      </p>
                    </div>

                    <Link
                      href={`/admin/orders/${order.id}`}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                    >
                      Open
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}