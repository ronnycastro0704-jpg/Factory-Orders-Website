"use client";

import Link from "next/link";
import { type DragEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "../../../lib/utils";

type AvailableOrder = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  adminSubmitted: boolean;
  status: string;
  overallProductionStatus: string;
  quantity: number;
  total: number;
  productSummary: string;
  createdAt: string;
};

type RecentInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  total: number;
  dueAt: string;
  createdAt: string;
  orderCount: number;
};

type Props = {
  availableOrders: AvailableOrder[];
  recentInvoices: RecentInvoice[];
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
  }).format(new Date(value));
}

function getStatusClasses(status: string) {
  switch (status) {
    case "PAID":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "COMPLETED":
      return "bg-green-50 text-green-700 border-green-200";
    case "READY":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PICKED_UP":
      return "bg-purple-50 text-purple-700 border-purple-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export default function InvoiceBuilder({
  availableOrders,
  recentInvoices,
}: Props) {
  const router = useRouter();

  const [selectedOrders, setSelectedOrders] = useState<AvailableOrder[]>([]);
  const [draggedOrderId, setDraggedOrderId] = useState("");
  const [dragOverDraft, setDragOverDraft] = useState(false);
const [searchQuery, setSearchQuery] = useState("");
const [notes, setNotes] = useState("");
const [surchargeLabel, setSurchargeLabel] = useState("Tax / tariff surcharge");
const [surchargeAmountInput, setSurchargeAmountInput] = useState("");
const [confirming, setConfirming] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  const selectedIds = useMemo(
    () => new Set(selectedOrders.map((order) => order.id)),
    [selectedOrders]
  );

const normalizedSearchQuery = searchQuery.trim().toLowerCase();

const filteredAvailableOrders = availableOrders
  .filter((order) => !selectedIds.has(order.id))
  .filter((order) => {
    if (!normalizedSearchQuery) return true;

    return [
      order.orderNumber,
      order.poNumber || "",
      order.customerName,
      order.customerEmail,
      order.productSummary,
      order.status,
      order.overallProductionStatus,
    ]
      .join(" ")
      .toLowerCase()
      .includes(normalizedSearchQuery);
  });

const selectedSubtotal = selectedOrders.reduce(
  (sum, order) => sum + order.total,
  0
);

const surchargeAmount = Math.max(0, Number(surchargeAmountInput || 0) || 0);
const selectedTotal = selectedSubtotal + surchargeAmount;

const invoiceCustomerOrder =
  selectedOrders.find((order) => !order.adminSubmitted) ||
  selectedOrders[0] ||
  null;

const selectedCustomerEmail = invoiceCustomerOrder?.customerEmail || "";
const selectedCustomerName = invoiceCustomerOrder?.customerName || "";

const selectedRegularCustomerEmail =
  selectedOrders.find((order) => !order.adminSubmitted)?.customerEmail || "";

  function getOrderById(orderId: string) {
    return availableOrders.find((order) => order.id === orderId) || null;
  }

function validateOrderCanBeAdded(order: AvailableOrder) {
  if (selectedIds.has(order.id)) {
    return "This order is already in the invoice draft.";
  }

  if (order.adminSubmitted) {
    return "";
  }

  if (
    selectedRegularCustomerEmail &&
    normalizeEmail(order.customerEmail) !==
      normalizeEmail(selectedRegularCustomerEmail)
  ) {
    return "All non-admin-submitted orders on one invoice must belong to the same customer email.";
  }

  return "";
}

  function addOrder(order: AvailableOrder) {
    const validationError = validateOrderCanBeAdded(order);

    if (validationError) {
      setError(validationError);
      return;
    }

    setSelectedOrders((current) => [...current, order]);
    setError("");
  }

  function removeOrder(orderId: string) {
    setSelectedOrders((current) =>
      current.filter((order) => order.id !== orderId)
    );
    setError("");
  }

  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    orderId: string
  ) {
    setDraggedOrderId(orderId);
    setError("");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderId);
  }

  function handleDragEnd() {
    setDraggedOrderId("");
    setDragOverDraft(false);
  }

  function handleDraftDragOver(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    if (!draggedOrderId) return;

    event.dataTransfer.dropEffect = "move";
    setDragOverDraft(true);
  }

  function handleDraftDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setDragOverDraft(false);
  }

  function handleDraftDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();

    const orderId =
      event.dataTransfer.getData("text/plain") || draggedOrderId;

    setDraggedOrderId("");
    setDragOverDraft(false);

    const order = getOrderById(orderId);

    if (!order) return;

    addOrder(order);
  }

  async function createInvoice() {
if (selectedOrders.length < 1) {
  setError("Please select at least one order before creating an invoice.");
  return;
}

    setCreating(true);
    setError("");

    try {
      const response = await fetch("/api/admin/invoices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
 body: JSON.stringify({
  orderIds: selectedOrders.map((order) => order.id),
  notes,
  surchargeLabel,
  surchargeAmount,
}),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create invoice.");
        setCreating(false);
        setConfirming(false);
        return;
      }

      router.push(`/admin/invoices/${data.id}`);
      router.refresh();
    } catch (invoiceError) {
      console.error(invoiceError);
      setError("Failed to create invoice.");
      setCreating(false);
    }
  }

  return (
    <section className="section-card-strong">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            Invoice Builder
          </p>
          <h2 className="mt-2 text-3xl font-bold">
            Drag orders into an invoice draft
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            Orders must belong to the same customer. Invoice terms will be Due
            upon receipt.
          </p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
<div className="mb-4 flex flex-wrap items-center justify-between gap-3">
  <div>
    <h3 className="text-xl font-bold">Available Orders</h3>
    <p className="mt-1 text-sm text-slate-500">
      Completed or paid orders not already on an active invoice.
    </p>
  </div>

  <span className="rounded-full border bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
    {filteredAvailableOrders.length} available
  </span>
</div>

<div className="mb-4 flex gap-3">
  <input
    value={searchQuery}
    onChange={(event) => setSearchQuery(event.target.value)}
    placeholder="Search order #, PO #, customer, email, product, status..."
    className="w-full rounded-xl border bg-white px-4 py-3 text-sm outline-none focus:border-slate-400"
  />
  {searchQuery ? (
    <button
      type="button"
      onClick={() => setSearchQuery("")}
      className="button-secondary whitespace-nowrap"
    >
      Clear
    </button>
  ) : null}
</div>

<div className="max-h-[700px] space-y-3 overflow-y-auto pr-2">
            {filteredAvailableOrders.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">
                No completed uninvoiced orders are available.
              </div>
            ) : (
              filteredAvailableOrders.map((order) => (
                <div
                  key={order.id}
                  draggable
                  onDragStart={(event) => handleDragStart(event, order.id)}
                  onDragEnd={handleDragEnd}
                  className={`rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    draggedOrderId === order.id
                      ? "opacity-50 ring-2 ring-slate-300"
                      : "cursor-grab active:cursor-grabbing"
                  }`}
                >
                  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    <span>Drag to invoice</span>
                    <span className="text-slate-300">⋮⋮</span>
                  </div>

                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-lg font-bold text-slate-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        PO # {order.poNumber || "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.customerName} • {order.customerEmail}
                      </p>
                      <p className="mt-2 text-sm font-medium text-slate-800">
                        {order.productSummary}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        Qty {order.quantity} • Created {formatDate(order.createdAt)}
                      </p>
                    </div>

                    <div className="flex flex-col items-start gap-2 lg:items-end">
                      <p className="text-xl font-bold">
                        {formatCurrency(order.total)}
                      </p>

                      <div className="flex flex-wrap gap-2 lg:justify-end">
  {order.adminSubmitted ? (
    <span className="inline-flex rounded-full border border-purple-200 bg-purple-50 px-2 py-1 text-[10px] font-semibold text-purple-700">
      Admin Submitted
    </span>
  ) : null}

                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusClasses(
                            order.status
                          )}`}
                        >
                          {order.status.replaceAll("_", " ")}
                        </span>

                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-semibold ${getStatusClasses(
                            order.overallProductionStatus
                          )}`}
                        >
                          {order.overallProductionStatus.replaceAll("_", " ")}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => addOrder(order)}
                        className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-50"
                      >
                        Add to Invoice
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        <div
          onDragOver={handleDraftDragOver}
          onDragLeave={handleDraftDragLeave}
          onDrop={handleDraftDrop}
          className={`rounded-2xl border p-4 shadow-sm transition ${
            dragOverDraft
              ? "border-slate-400 bg-slate-100 ring-2 ring-slate-300"
              : "bg-white"
          }`}
        >
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-bold">Invoice Draft</h3>
              <p className="mt-1 text-sm text-slate-500">
                Drop orders here to group them into one invoice.
              </p>
            </div>

            <span className="rounded-full border bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {selectedOrders.length} selected
            </span>
          </div>

          {selectedOrders.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-slate-50 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                Drop completed orders here
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Select at least two orders from the same customer.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="rounded-2xl border bg-slate-50 p-4">
                <p className="text-xs uppercase tracking-[0.14em] text-slate-500">
                  Customer
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {selectedCustomerName}
                </p>
                <p className="text-sm text-slate-600">
                  {selectedCustomerEmail}
                </p>
              </div>

              {selectedOrders.map((order) => (
                <div
                  key={order.id}
                  className="rounded-2xl border bg-white p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-bold text-slate-900">
                        {order.orderNumber}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        PO # {order.poNumber || "—"}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {order.productSummary}
                      </p>
                      {order.adminSubmitted ? (
  <p className="mt-1 text-xs font-semibold text-purple-700">
    Admin submitted exception
  </p>
) : null}
                      <p className="mt-1 text-xs text-slate-500">
                        Qty {order.quantity}
                      </p>
                    </div>

                    <div className="text-right">
                      <p className="font-bold">
                        {formatCurrency(order.total)}
                      </p>
                      <button
                        type="button"
                        onClick={() => removeOrder(order.id)}
                        className="mt-2 text-xs font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              ))}

<div>
  <label className="mb-1 block text-sm font-medium">
    Invoice Notes
  </label>
  <textarea
    className="w-full rounded-lg border px-3 py-2"
    rows={3}
    value={notes}
    onChange={(event) => setNotes(event.target.value)}
    placeholder="Optional notes for this invoice"
  />
</div>

<div className="grid gap-3 sm:grid-cols-[1fr_160px]">
  <div>
    <label className="mb-1 block text-sm font-medium">
      Surcharge Label
    </label>
    <input
      className="w-full rounded-lg border px-3 py-2"
      value={surchargeLabel}
      onChange={(event) => setSurchargeLabel(event.target.value)}
      placeholder="Tax / tariff surcharge"
    />
  </div>

  <div>
    <label className="mb-1 block text-sm font-medium">
      Surcharge Amount
    </label>
    <input
      className="w-full rounded-lg border px-3 py-2"
      value={surchargeAmountInput}
      onChange={(event) => setSurchargeAmountInput(event.target.value)}
      inputMode="decimal"
      placeholder="0.00"
    />
  </div>
</div>

<div className="rounded-2xl border bg-slate-900 p-5 text-white">
  <div className="space-y-2">
    <div className="flex items-center justify-between gap-4 text-sm">
      <span className="text-slate-300">Subtotal</span>
      <span className="font-semibold">
        {formatCurrency(selectedSubtotal)}
      </span>
    </div>

    {surchargeAmount > 0 ? (
      <div className="flex items-center justify-between gap-4 text-sm">
        <span className="text-slate-300">
          {surchargeLabel || "Surcharge"}
        </span>
        <span className="font-semibold">
          {formatCurrency(surchargeAmount)}
        </span>
      </div>
    ) : null}

    <div className="flex items-center justify-between gap-4 border-t border-white/20 pt-3">
      <div>
        <p className="text-sm uppercase tracking-[0.16em] text-slate-300">
          Invoice Total
        </p>
        <p className="mt-1 text-xs text-slate-300">
          Terms: Due upon receipt
        </p>
      </div>

      <p className="text-3xl font-bold">
        {formatCurrency(selectedTotal)}
      </p>
    </div>
  </div>
</div>

              <button
                type="button"
                onClick={() => setConfirming(true)}
                disabled={selectedOrders.length < 1 || creating}
                className="w-full rounded-lg bg-slate-900 px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Create Invoice
              </button>

              {selectedOrders.length === 1 ? (
  <p className="text-center text-xs text-slate-500">
    This invoice will be created with one order.
  </p>
) : null}
            </div>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-2xl border bg-white p-4 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold">Recent Invoices</h3>
            <p className="mt-1 text-sm text-slate-500">
              Recently created grouped invoices.
            </p>
          </div>
        </div>

        {recentInvoices.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-slate-50 p-8 text-center text-sm text-slate-500">
            No invoices created yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-sm">
              <thead>
                <tr className="border-b text-xs uppercase tracking-[0.12em] text-slate-500">
                  <th className="py-3 pr-4">Invoice</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Orders</th>
                  <th className="py-3 pr-4">Due</th>
                  <th className="py-3 pr-4 text-right">Total</th>
                  <th className="py-3 pr-4"></th>
                </tr>
              </thead>
              <tbody>
                {recentInvoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0">
                    <td className="py-4 pr-4 font-semibold">
                      {invoice.invoiceNumber}
                    </td>
                    <td className="py-4 pr-4">
                      <p>{invoice.customerName}</p>
                      <p className="text-xs text-slate-500">
                        {invoice.customerEmail}
                      </p>
                    </td>
                    <td className="py-4 pr-4">{invoice.orderCount}</td>
                    <td className="py-4 pr-4">{formatDate(invoice.dueAt)}</td>
                    <td className="py-4 pr-4 text-right font-bold">
                      {formatCurrency(invoice.total)}
                    </td>
                    <td className="py-4 pr-4 text-right">
                      <Link
                        href={`/admin/invoices/${invoice.id}`}
                        className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                      >
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirming ? (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-6">
          <div className="mt-4 w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Confirm Invoice
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Create invoice for {selectedOrders.length} orders?
            </h2>

<div className="mt-4 rounded-xl border bg-slate-50 p-4">
  <p className="text-sm text-slate-600">
    Customer:{" "}
    <span className="font-semibold text-slate-900">
      {selectedCustomerName}
    </span>
  </p>

  <p className="mt-1 text-sm text-slate-600">
    Terms:{" "}
    <span className="font-semibold text-slate-900">
      Due upon receipt
    </span>
  </p>

  <p className="mt-3 text-sm text-slate-600">
    Subtotal:{" "}
    <span className="font-semibold text-slate-900">
      {formatCurrency(selectedSubtotal)}
    </span>
  </p>

  {surchargeAmount > 0 ? (
    <p className="mt-1 text-sm text-slate-600">
      {surchargeLabel || "Surcharge"}:{" "}
      <span className="font-semibold text-slate-900">
        {formatCurrency(surchargeAmount)}
      </span>
    </p>
  ) : null}

  <p className="mt-3 text-3xl font-bold text-slate-900">
    {formatCurrency(selectedTotal)}
  </p>
</div>

            <div className="mt-4 max-h-48 space-y-2 overflow-y-auto">
              {selectedOrders.map((order) => (
                <div
                  key={order.id}
                  className="flex items-start justify-between gap-4 rounded-xl border p-3 text-sm"
                >
                  <div>
                    <p className="font-semibold">{order.orderNumber}</p>
                    <p className="text-slate-500">
                      PO # {order.poNumber || "—"} • {order.productSummary}
                    </p>
                  </div>
                  <p className="font-semibold">
                    {formatCurrency(order.total)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={creating}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={createInvoice}
                disabled={creating}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {creating ? "Creating..." : "Create Invoice"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}