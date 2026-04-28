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
  quantity: number;
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
          selections: {
            orderBy: {
              createdAt: "asc",
            },
          },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const typedItems = order.items as OrderItemWithSelections[];

  const allPriceLines = typedItems.flatMap((item) => [
    {
      label: `${item.productNameSnapshot} Base Price`,
      amount: Number(item.basePriceSnapshot),
    },
    ...item.selections.map((selection) => ({
      label: `${selection.optionGroupNameSnapshot}: ${cleanChoiceLabel(
        selection.optionChoiceNameSnapshot
      )}`,
      amount: Number(selection.priceDeltaSnapshot),
    })),
  ]);

  const perUnitSubtotal = typedItems.reduce(
    (sum, item) => sum + Number(item.lineTotal),
    0
  );

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/orders" className="button-secondary">
              ← Admin Orders
            </Link>

            <Link
              href={`/admin/production/${order.id}`}
              className="button-secondary"
            >
              Open Production View
            </Link>
          </div>

          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(
              order.status
            )}`}
          >
            {order.status.replaceAll("_", " ")}
          </span>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Read-only customer order</p>
          <h1 className="mt-2 text-3xl font-bold">{order.orderNumber}</h1>
          <p className="mt-2 text-slate-600">
            This view shows what the customer selected. Admins cannot edit the
            customer configuration here.
          </p>

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

        <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
          <div className="space-y-6">
            {typedItems.map((item) => (
              <div key={item.id} className="space-y-6">
                <div className="rounded-2xl border bg-white p-5 shadow-sm">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-2xl font-semibold">
                        {item.productNameSnapshot}
                      </h2>
                      <p className="mt-1 text-sm text-slate-500">
                        Base Price:{" "}
                        {formatCurrency(Number(item.basePriceSnapshot))}
                      </p>
                    </div>

                    <span className="rounded-full border bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                      {item.selections.length} selected
                    </span>
                  </div>
                </div>

                {item.selections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed bg-white p-6 text-sm text-slate-500">
                    No selections saved for this item.
                  </div>
                ) : (
                  item.selections.map((selection) => (
                    <div
                      key={selection.id}
                      className="rounded-2xl border bg-white p-5 shadow-sm"
                    >
                      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-semibold">
                            {selection.optionGroupNameSnapshot}
                          </h2>
                          <p className="mt-1 text-sm text-slate-500">
                            Customer selected choice
                          </p>
                        </div>

                        <span className="rounded-full border bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                          Selected
                        </span>
                      </div>

                      <div className="rounded-2xl border border-[var(--brand)] bg-[var(--brand-soft)] p-4 ring-2 ring-[var(--brand)]">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="font-semibold">
                              {cleanChoiceLabel(
                                selection.optionChoiceNameSnapshot
                              )}
                            </p>
                            <p className="mt-2 text-sm text-slate-500">
                              Saved from the customer&apos;s submitted order.
                            </p>
                          </div>

                          <div className="whitespace-nowrap text-sm font-medium">
                            {Number(selection.priceDeltaSnapshot) === 0
                              ? "Included"
                              : `+${formatCurrency(
                                  Number(selection.priceDeltaSnapshot)
                                )}`}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>

          <div className="space-y-6">
            <div className="h-fit rounded-2xl border bg-white p-5 shadow-sm">
              <h2 className="text-xl font-semibold">Customer Information</h2>

              <div className="mt-4 space-y-4">
                <div>
                  <label className="mb-1 block text-sm font-medium">PO #</label>
                  <input
                    className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-700"
                    value={order.poNumber || ""}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Quantity
                  </label>
                  <input
                    className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-700"
                    value={order.quantity}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">Name</label>
                  <input
                    className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-700"
                    value={order.customerName}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Email
                  </label>
                  <input
                    className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-700"
                    value={order.customerEmail}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Phone
                  </label>
                  <input
                    className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-700"
                    value={order.customerPhone || ""}
                    readOnly
                    disabled
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium">
                    Notes
                  </label>
                  <textarea
                    className="w-full rounded-lg border bg-gray-100 px-3 py-2 text-gray-700"
                    rows={4}
                    value={order.notes || ""}
                    readOnly
                    disabled
                  />
                </div>
              </div>
            </div>

            <div className="h-fit rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Itemized Price</h2>

              <div className="mt-2 text-sm text-slate-500">
                Prices below are per unit.
              </div>

              <div className="mt-4 space-y-3">
                {allPriceLines.map((line) => (
                  <div
                    key={`${line.label}-${line.amount}`}
                    className="flex justify-between gap-4 border-b pb-2 text-sm"
                  >
                    <span>{line.label}</span>
                    <span className="whitespace-nowrap">
                      {line.amount === 0
                        ? "Included"
                        : `+${formatCurrency(line.amount)}`}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-6 space-y-3 border-t pt-4">
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Per Unit Subtotal</span>
                  <span>{formatCurrency(perUnitSubtotal)}</span>
                </div>

                <div className="flex justify-between text-sm text-slate-600">
                  <span>Quantity</span>
                  <span>x {order.quantity}</span>
                </div>

                <div className="flex justify-between text-xl font-bold">
                  <span>Total</span>
                  <span>{formatCurrency(Number(order.total))}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                href="/admin/orders"
                className="rounded-lg border px-4 py-2 hover:bg-slate-100"
              >
                Admin Orders
              </Link>

              <Link
                href={`/admin/production/${order.id}`}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100"
              >
                Production View
              </Link>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}