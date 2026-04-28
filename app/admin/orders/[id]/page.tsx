import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import { formatCurrency } from "../../../../lib/utils";
import {
  formatCentralDate,
  formatCentralDateTime,
} from "../../../../lib/central-time";
import FactoryActions from "./factory-actions";
import ProductionLineEditor from "./production-line-editor";

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

type ProductionLineItem = {
  id: string;
  partNumber: string;
  frameNeeded: string;
  quantity: number;
  bodyLeather: string | null;
  dueDate: Date | null;
  priority: string;
  currentStatus: string;
  lineNotes: string | null;
  completedPhotoUrl: string | null;

  millFirstStatus: string;
  leatherOrderedStatus: string;
  millStatus: string;
  frameAssemblyStatus: string;
  leatherArrivedStatus: string;
  leaCutStatus: string;
  sewnStatus: string;
  upholsteryStatus: string;
  upholsteredStatus: string;
  finalAssemblyStatus: string;
  qcStatus: string;

  leaCutAssignedTo: string | null;
  upholsteryAssignedTo: string | null;
  upholsteredAssignedTo: string | null;
  finalAssemblyAssignedTo: string | null;
  qcAssignedTo: string | null;

  pickedUp: boolean;
  pickedUpAt: Date | null;
  updatedAt: Date;
};

type OrderRevisionItem = {
  id: string;
  revisionNumber: number;
  changeReason: string | null;
  changedBy: string | null;
  createdAt: Date;
};

function formatPriorityLabel(priority: string) {
  return priority === "HOLD" ? "HOT" : priority;
}

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

function getProductionStatusClasses(status: string) {
  switch (status) {
    case "BLOCKED":
      return "bg-red-50 text-red-700 border-red-200";
    case "READY":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PICKED_UP":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "CUTTING":
    case "SEWING":
    case "UPHOLSTERY":
    case "FINAL_ASSEMBLY":
    case "QC":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "WAITING_ON_LEATHER":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export default async function AdminOrderDetailPage({ params }: PageProps) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          selections: true,
        },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
      },
      productionLines: {
        orderBy: [{ partNumber: "asc" }, { frameNeeded: "asc" }],
      },
    },
  });

  if (!order) {
    notFound();
  }

  const typedItems = order.items as OrderItemWithSelections[];
  const typedProductionLines = order.productionLines as ProductionLineItem[];
  const typedRevisions = order.revisions as OrderRevisionItem[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/orders" className="button-secondary">
            ← Orders
          </Link>
          <Link href="/admin/production" className="button-secondary">
            Production
          </Link>
          <Link href="/admin/products" className="button-secondary">
            Products
          </Link>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Order</p>

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

            <div className="flex flex-wrap gap-2">
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(
                  order.status
                )}`}
              >
                {order.status.replaceAll("_", " ")}
              </span>

              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getProductionStatusClasses(
                  order.overallProductionStatus
                )}`}
              >
                {order.overallProductionStatus.replaceAll("_", " ")}
              </span>

              <span className="inline-flex rounded-full border bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                Priority: {formatPriorityLabel(order.priority)}
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 text-sm text-slate-500 sm:grid-cols-2 lg:grid-cols-6">
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
              <p className="text-xs uppercase tracking-[0.14em]">Picked Up</p>
              <p className="mt-1 text-slate-700">
                {order.pickedUpAt ? formatCentralDate(order.pickedUpAt) : "—"}
              </p>
            </div>

            <div>
              <p className="text-xs uppercase tracking-[0.14em]">
                Production Lines
              </p>
              <p className="mt-1 text-slate-700">
                {typedProductionLines.length}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">
                Customer Order Choices
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Read-only view of exactly what the customer selected.
              </p>
            </div>

            <span className="inline-flex rounded-full border bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {typedItems.length} item{typedItems.length === 1 ? "" : "s"}
            </span>
          </div>

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

        <FactoryActions orderId={order.id} currentStatus={order.status} />

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Production Lines</h2>
              <p className="mt-2 text-sm text-slate-500">
                Factory production tracking for this order.
              </p>
            </div>

            <span className="inline-flex rounded-full border bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {typedProductionLines.length} line
              {typedProductionLines.length === 1 ? "" : "s"}
            </span>
          </div>

          {typedProductionLines.length === 0 ? (
            <div className="mt-6 rounded-xl border border-dashed bg-slate-50 p-6 text-sm text-slate-500">
              No production lines yet.
            </div>
          ) : (
            <div className="mt-6 space-y-6">
              {typedProductionLines.map((line) => (
                <ProductionLineEditor
                  key={line.id}
                  line={{
                    ...line,
                    dueDate: line.dueDate ? line.dueDate.toISOString() : null,
                    pickedUpAt: line.pickedUpAt
                      ? line.pickedUpAt.toISOString()
                      : null,
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <h2 className="text-2xl font-semibold">Revision History</h2>

          <div className="mt-4 space-y-4">
            {typedRevisions.length === 0 ? (
              <p className="text-slate-500">No revisions yet.</p>
            ) : (
              typedRevisions.map((revision) => (
                <div
                  key={revision.id}
                  className="rounded-xl border bg-slate-50 p-4"
                >
                  <p className="font-medium">
                    Revision #{revision.revisionNumber}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {revision.changeReason || "No reason provided"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Changed by: {revision.changedBy || "Unknown"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {formatCentralDateTime(revision.createdAt)}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </main>
  );
}