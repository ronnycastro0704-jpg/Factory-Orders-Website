import Link from "next/link";
import { Prisma } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";

type PageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

type OrderRow = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  status: string;
  quantity: number;
  total: unknown;
  createdAt: Date;
  updatedAt: Date;
  items: {
    id: string;
    productNameSnapshot: string;
    selections: {
      id: string;
      leatherNameSnapshot: string | null;
      leatherInventoryUsageSnapshot: unknown | null;
    }[];
  }[];
};

type LeatherInventoryRow = {
  name: string;
  inventoryUnits: unknown;
};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function getStatusClasses(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
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

export default async function MyOrdersPage({ searchParams }: PageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const params = await searchParams;
  const query = String(params.q || "").trim();
  const userEmail = session.user.email.toLowerCase();

  const normalizedStatusQuery = query.toUpperCase().replaceAll(" ", "_");

  const validStatusQuery = [
    "DRAFT",
    "SUBMITTED",
    "CHANGED",
    "SENT_TO_FACTORY",
    "COMPLETED",
    "PAID",
    "CANCELLED",
  ].includes(normalizedStatusQuery)
    ? normalizedStatusQuery
    : null;

  const where: Prisma.OrderWhereInput = {
    customerEmail: userEmail,
    ...(query
      ? {
          OR: [
            { orderNumber: { contains: query, mode: "insensitive" } },
            { poNumber: { contains: query, mode: "insensitive" } },
            ...(validStatusQuery
              ? [
                  {
                    status: {
                      equals:
                        validStatusQuery as Prisma.EnumOrderStatusFilter["equals"],
                    },
                  },
                ]
              : []),
            {
              items: {
                some: {
                  productNameSnapshot: {
                    contains: query,
                    mode: "insensitive",
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const orders = (await prisma.order.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      items: {
        select: {
          id: true,
          productNameSnapshot: true,
          selections: {
            select: {
              id: true,
              leatherNameSnapshot: true,
              leatherInventoryUsageSnapshot: true,
            },
          },
        },
      },
    },
  })) as OrderRow[];

  const selectedLeatherNames = Array.from(
    new Set(
      orders
        .flatMap((order) =>
          order.items.flatMap((item) =>
            item.selections
              .map((selection) => selection.leatherNameSnapshot)
              .filter(Boolean)
          )
        )
        .map((name) => String(name))
    )
  );

  const leatherInventoryRows = selectedLeatherNames.length
    ? ((await prisma.leather.findMany({
        where: {
          name: {
            in: selectedLeatherNames,
          },
        },
        select: {
          name: true,
          inventoryUnits: true,
        },
      })) as LeatherInventoryRow[])
    : [];

  const leatherInventoryMap = new Map(
    leatherInventoryRows.map((leather) => [
      leather.name.trim().toLowerCase(),
      Number(leather.inventoryUnits || 0),
    ])
  );

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
                Search by PO #, order number, product, or status.
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
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Orders
              </p>
              <h2 className="mt-2 text-3xl font-bold">Your Order History</h2>
            </div>

            <form className="flex w-full gap-3 lg:max-w-xl">
              <input
                name="q"
                defaultValue={query}
                placeholder="Search PO #, order #, product, status..."
                className="w-full rounded-xl border bg-white px-4 py-3 text-sm"
              />
              <button type="submit" className="button-primary whitespace-nowrap">
                Search
              </button>
              {query ? (
                <Link href="/my/orders" className="button-secondary">
                  Clear
                </Link>
              ) : null}
            </form>
          </div>

          <div className="mb-6">
            <span className="status-pill">
              {orders.length} order{orders.length === 1 ? "" : "s"}
            </span>
          </div>

          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                {query
                  ? "No orders matched your search."
                  : "You do not have any orders yet."}
              </p>
              <p className="mt-2 text-sm text-slate-500">
                {query
                  ? "Try searching a different PO #, order number, product, or status."
                  : "Go back to the product page and create your first order."}
              </p>
              <div className="mt-6">
                <Link href={query ? "/my/orders" : "/"} className="button-primary">
                  {query ? "Clear Search" : "Browse Products"}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {orders.map((order: OrderRow) => {
                const firstItem = order.items[0];
const leatherInventoryNotes = order.items.flatMap((item) =>
  item.selections
    .filter((selection) => selection.leatherNameSnapshot)
    .map((selection) => {
      const leatherName = String(selection.leatherNameSnapshot || "");
      const inventoryUnits =
        leatherInventoryMap.get(leatherName.trim().toLowerCase()) ?? null;

      if (inventoryUnits === null) return null;

      return `${leatherName}: ${inventoryUnits.toFixed(2)} units in stock`;
    })
    .filter(Boolean)
);

                return (
                  <div key={order.id} className="premium-grid-card">
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold">
                              PO # {order.poNumber || "—"}
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
                            Order #: {order.orderNumber}
                          </p>

                          <p className="mt-3 text-sm text-slate-600">
                            Product: {firstItem?.productNameSnapshot || "—"}
                          </p>

{leatherInventoryNotes.length > 0 ? (
  <div className="mt-3 rounded-xl border bg-white/80 p-3 text-sm text-slate-700">
    <p className="font-semibold text-slate-900">
      Current leather stock
    </p>
    <ul className="mt-1 list-inside list-disc">
      {leatherInventoryNotes.map((note) => (
        <li key={String(note)}>{note}</li>
      ))}
    </ul>
  </div>
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

                        {order.status === "DRAFT" ||
                        order.status === "CHANGED" ? (
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