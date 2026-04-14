import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";

type SearchParams = Promise<{
  status?: string;
  emailStatus?: string;
  sheetStatus?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

const statusTabs = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Changed", value: "CHANGED" },
  { label: "Sent to Factory", value: "SENT_TO_FACTORY" },
  { label: "Completed", value: "COMPLETED" },
];

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const status = params.status || "";
  const emailStatus = params.emailStatus || "";
  const sheetStatus = params.sheetStatus || "";

  const orders = await prisma.order.findMany({
    where: {
      ...(status ? { status: status as never } : {}),
      ...(emailStatus
        ? {
            emailLogs: {
              some: {
                status: emailStatus,
              },
            },
          }
        : {}),
      ...(sheetStatus
        ? {
            sheetSyncLogs: {
              some: {
                status: sheetStatus,
              },
            },
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    include: {
      items: true,
      emailLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      sheetSyncLogs: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm text-slate-500">Admin</p>
          <h1 className="text-4xl font-bold">Orders Dashboard</h1>
          <p className="mt-2 text-slate-600">
            Review recent orders, factory submissions, and exceptions.
          </p>
        </div>

        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            {statusTabs.map((tab) => {
              const href =
                tab.value === ""
                  ? "/admin/orders"
                  : `/admin/orders?status=${tab.value}`;

              const isActive =
                (tab.value === "" && !status && !emailStatus && !sheetStatus) ||
                status === tab.value;

              return (
                <Link
                  key={tab.label}
                  href={href}
                  className={`rounded-lg px-3 py-2 text-sm ${
                    isActive
                      ? "bg-slate-900 text-white"
                      : "border hover:bg-slate-100"
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}

            <Link
              href="/admin/orders?emailStatus=FAILED"
              className={`rounded-lg px-3 py-2 text-sm ${
                emailStatus === "FAILED"
                  ? "bg-red-600 text-white"
                  : "border hover:bg-slate-100"
              }`}
            >
              Failed Emails
            </Link>

            <Link
              href="/admin/orders?sheetStatus=FAILED"
              className={`rounded-lg px-3 py-2 text-sm ${
                sheetStatus === "FAILED"
                  ? "bg-red-600 text-white"
                  : "border hover:bg-slate-100"
              }`}
            >
              Failed Sheets
            </Link>

            <Link
              href="/admin/orders"
              className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
            >
              Clear Filters
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Orders</h2>
            <span className="text-sm text-slate-500">
              {orders.length} results
            </span>
          </div>

          <div className="space-y-4">
            {orders.length === 0 ? (
              <p className="text-slate-500">No orders found.</p>
            ) : (
              orders.map((order) => {
                const firstItem = order.items[0];
                const latestEmail = order.emailLogs[0];
                const latestSheet = order.sheetSyncLogs[0];

                return (
                  <div
                    key={order.id}
                    className="rounded-xl border p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">
                          {order.orderNumber}
                        </h3>
                        <p className="text-sm text-slate-500">
                          {order.customerName} • {order.customerEmail}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {firstItem?.productNameSnapshot || "No item"}
                        </p>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs">
                          <span className="rounded-full bg-slate-100 px-2 py-1">
                            Status: {order.status}
                          </span>
                          {latestEmail ? (
                            <span
                              className={`rounded-full px-2 py-1 ${
                                latestEmail.status === "FAILED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              Email: {latestEmail.status}
                            </span>
                          ) : null}
                          {latestSheet ? (
                            <span
                              className={`rounded-full px-2 py-1 ${
                                latestSheet.status === "FAILED"
                                  ? "bg-red-100 text-red-700"
                                  : "bg-green-100 text-green-700"
                              }`}
                            >
                              Sheets: {latestSheet.status}
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="md:text-right">
                        <p className="text-lg font-semibold">
                          {formatCurrency(Number(order.total))}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                        <div className="mt-3">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                          >
                            Open Order
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </main>
  );
}