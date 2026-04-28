import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";
import { formatCentralDateTime } from "../../../lib/central-time";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  customerPhone: string | null;
  status: string;
  overallProductionStatus: string;
  priority: string;
  quantity: number;
  total: unknown;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productNameSnapshot: string;
  }[];
  productionLines: {
    id: string;
  }[];
};

function getStatusClasses(status: string) {
  switch (status) {
    case "SENT_TO_FACTORY":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-200";
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
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

function formatPriorityLabel(priority: string) {
  return priority === "HOLD" ? "HOT" : priority;
}

export default async function AdminOrdersPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = String(params.q || "").trim();

  const searchWhere: Prisma.OrderWhereInput = query
    ? {
        OR: [
          { orderNumber: { contains: query, mode: "insensitive" } },
          { customerName: { contains: query, mode: "insensitive" } },
          { customerEmail: { contains: query, mode: "insensitive" } },
          { poNumber: { contains: query, mode: "insensitive" } },
        ],
      }
    : {};

  const [
    totalOrders,
    changedOrders,
    sentToFactoryOrders,
    completedOrders,
    paidOrders,
    orders,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({
      where: { status: "CHANGED" },
    }),
    prisma.order.count({
      where: { status: "SENT_TO_FACTORY" },
    }),
    prisma.order.count({
      where: { status: "COMPLETED" },
    }),
    prisma.order.count({
      where: { status: "PAID" },
    }),
    prisma.order.findMany({
      where: searchWhere,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        items: {
          select: {
            id: true,
            productNameSnapshot: true,
          },
        },
        productionLines: {
          select: {
            id: true,
          },
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
                Track orders and production
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Search, review, and open customer orders from one clean table.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/production" className="button-secondary">
                Production
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

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{totalOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Changed Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{changedOrders}</p>
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
              Paid Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{paidOrders}</p>
          </div>
        </section>

        <section className="mt-8 section-card-strong">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Orders
              </p>
              <h2 className="mt-2 text-3xl font-bold">
                {query ? "Search Results" : "Latest Orders"}
              </h2>
            </div>

            <form className="flex w-full gap-3 lg:max-w-xl">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search order #, customer, email, or PO..."
                className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
              />
              <button type="submit" className="button-primary whitespace-nowrap">
                Search
              </button>
              {query ? (
                <Link href="/admin/orders" className="button-secondary">
                  Clear
                </Link>
              ) : null}
            </form>
          </div>

          <div className="overflow-x-auto rounded-2xl border bg-white">
            <table className="w-full min-w-[1100px] text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                <tr>
                  <th className="px-4 py-3">Order</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Product</th>
                  <th className="px-4 py-3">PO</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Production</th>
                  <th className="px-4 py-3">Qty</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Created</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {typedOrders.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-10 text-center text-slate-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  typedOrders.map((order) => {
                    const firstItem = order.items[0];

                    return (
                      <tr
                        key={order.id}
                        className="border-b last:border-b-0 hover:bg-slate-50"
                      >
                        <td className="px-4 py-4 align-top">
                          <p className="font-semibold text-slate-900">
                            {order.orderNumber}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {formatCentralDateTime(order.updatedAt)}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <p className="font-medium text-slate-900">
                            {order.customerName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {order.customerEmail}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top text-slate-700">
                          {firstItem?.productNameSnapshot || "—"}
                        </td>

                        <td className="px-4 py-4 align-top text-slate-700">
                          {order.poNumber || "—"}
                        </td>

                        <td className="px-4 py-4 align-top">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                              order.status
                            )}`}
                          >
                            {order.status.replaceAll("_", " ")}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-top">
                          <p className="text-slate-700">
                            {order.overallProductionStatus.replaceAll("_", " ")}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {order.productionLines.length} line
                            {order.productionLines.length === 1 ? "" : "s"} ·{" "}
                            {formatPriorityLabel(order.priority)}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-top text-slate-700">
                          {order.quantity}
                        </td>

                        <td className="px-4 py-4 align-top font-semibold text-slate-900">
                          {formatCurrency(Number(order.total))}
                        </td>

                        <td className="px-4 py-4 align-top text-slate-700">
                          {formatCentralDateTime(order.createdAt)}
                        </td>

                        <td className="px-4 py-4 text-right align-top">
                          <Link
                            href={`/admin/orders/${order.id}`}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm text-slate-500">
            Showing {typedOrders.length} order{typedOrders.length === 1 ? "" : "s"}.
          </p>
        </section>
      </div>
    </main>
  );
}