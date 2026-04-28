import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { formatCurrency } from "../../../../lib/utils";
import {
  formatCentralDate,
  formatCentralDateTime,
} from "../../../../lib/central-time";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type OrderSelectionItem = {
  id: string;
  optionGroupNameSnapshot: string;
  optionChoiceNameSnapshot: string;
  priceDeltaSnapshot: unknown;
};

type OrderItemWithSelections = {
  id: string;
  productNameSnapshot: string;
  basePriceSnapshot: unknown;
  lineTotal: unknown;
  selections: OrderSelectionItem[];
};

function cleanChoiceLabel(value: string) {
  return value.replaceAll("|||", " — ");
}

function getOrderStatusClasses(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "CHANGED":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "SENT_TO_FACTORY":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-200";
    case "CANCELLED":
      return "bg-red-50 text-red-700 border-red-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default async function AdminOrderReadOnlyPage({ params }: PageProps) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          selections: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const typedItems = order.items as OrderItemWithSelections[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/orders" className="button-secondary">
            ← Orders
          </Link>
          <Link
            href={`/admin/production/${order.id}`}
            className="button-secondary"
          >
            Open Production View
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Read-only customer order</p>

          <div className="mt-2 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h1 className="text-3xl font-bold">{order.orderNumber}</h1>

              <p className="mt-2 text-slate-600">
                {order.customerName} • {order.customerEmail}
              </p>

              {order.customerPhone ? (
                <p className="mt-1 text-slate-600">{order.customerPhone}</p>
              ) : null}

              {order.poNumber ? (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  PO #: {order.poNumber}
                </p>
              ) : null}

              {order.notes ? (
                <p className="mt-4 text-slate-600">Notes: {order.notes}</p>
              ) : null}
            </div>

            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(
                order.status
              )}`}
            >
              {order.status.replaceAll("_", " ")}
            </span>
          </div>

          <div className="mt-6 grid gap-4 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-5">
            <div>
              <p className="text-xs uppercase tracking-[0.14em]">Created</p>
              <p className="mt-1 text-slate-700">
                {formatCentralDateTime(order.createdAt)}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em]">Total</p>
              <p className="mt-1 text-slate-700">
                {formatCurrency(Number(order.total))}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em]">Quantity</p>
              <p className="mt-1 text-slate-700">{order.quantity}</p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em]">Due Date</p>
              <p className="mt-1 text-slate-700">
                {order.dueDate ? formatCentralDate(order.dueDate) : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em]">Items</p>
              <p className="mt-1 text-slate-700">{typedItems.length}</p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Customer Order Choices</h2>
          <p className="mt-2 text-sm text-slate-500">
            This is a read-only view of what the customer selected.
          </p>

          <div className="mt-6 space-y-6">
            {typedItems.map((item) => (
              <div key={item.id} className="rounded-2xl border bg-slate-50 p-5">
                <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h3 className="text-xl font-semibold">
                      {item.productNameSnapshot}
                    </h3>
                    <p className="mt-1 text-sm text-slate-600">
                      Base Price:{" "}
                      {formatCurrency(Number(item.basePriceSnapshot))}
                    </p>
                  </div>

                  <p className="text-lg font-semibold text-slate-900">
                    {formatCurrency(Number(item.lineTotal))}
                  </p>
                </div>

                <div className="overflow-x-auto rounded-xl border bg-white">
                  <table className="w-full min-w-[650px] text-left text-sm">
                    <thead className="border-b bg-slate-50 text-xs uppercase tracking-[0.14em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Option Group</th>
                        <th className="px-4 py-3">Customer Choice</th>
                        <th className="px-4 py-3 text-right">Price</th>
                      </tr>
                    </thead>

                    <tbody>
                      {item.selections.length === 0 ? (
                        <tr>
                          <td
                            colSpan={3}
                            className="px-4 py-6 text-center text-slate-500"
                          >
                            No selections saved for this item.
                          </td>
                        </tr>
                      ) : (
                        item.selections.map((selection) => (
                          <tr
                            key={selection.id}
                            className="border-b last:border-b-0"
                          >
                            <td className="px-4 py-3 font-medium text-slate-900">
                              {selection.optionGroupNameSnapshot}
                            </td>
                            <td className="px-4 py-3 text-slate-700">
                              {cleanChoiceLabel(
                                selection.optionChoiceNameSnapshot
                              )}
                            </td>
                            <td className="px-4 py-3 text-right font-medium">
                              {Number(selection.priceDeltaSnapshot) === 0
                                ? "Included"
                                : formatCurrency(
                                    Number(selection.priceDeltaSnapshot)
                                  )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}