"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { formatCurrency } from "../../../lib/utils";

type ScheduleDay =
  | "UNSCHEDULED"
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

type ScheduledOrder = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  customerEmail: string;
  status: string;
  priority: string;
  quantity: number;
  total: number;
  dueDate: string | null;
  weeklyScheduleDay: string | null;
  overallProductionStatus: string;
  createdAt: string;
};

type ScheduleColumn = {
  key: ScheduleDay;
  label: string;
  orders: ScheduledOrder[];
};

type Props = {
  columns: ScheduleColumn[];
};

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
    case "DRAFT":
      return "bg-slate-100 text-slate-700 border-slate-200";
    case "SUBMITTED":
      return "bg-indigo-50 text-indigo-700 border-indigo-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getPriorityClasses(priority: string) {
  switch (priority) {
    case "RUSH":
      return "bg-red-50 text-red-700 border-red-200";
    case "HOLD":
    case "HOT":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function formatPriorityLabel(priority: string) {
  return priority === "HOLD" ? "HOT" : priority;
}

function formatDate(value: string | null) {
  if (!value) return "—";

  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
  }).format(new Date(value));
}

function normalizeReturnedOrder(
  original: ScheduledOrder,
  returnedOrder: Partial<ScheduledOrder>
): ScheduledOrder {
  return {
    ...original,
    ...returnedOrder,
    dueDate: returnedOrder.dueDate || original.dueDate,
    weeklyScheduleDay:
      returnedOrder.weeklyScheduleDay === undefined
        ? original.weeklyScheduleDay
        : returnedOrder.weeklyScheduleDay,
    createdAt: returnedOrder.createdAt || original.createdAt,
  };
}

export default function ScheduleBoard({ columns }: Props) {
  const router = useRouter();

  const topScrollRef = useRef<HTMLDivElement | null>(null);
  const boardScrollRef = useRef<HTMLDivElement | null>(null);

const [boardColumns, setBoardColumns] = useState(columns);
const [draggedOrderId, setDraggedOrderId] = useState("");
const [dragOverDay, setDragOverDay] = useState<ScheduleDay | "">("");
const [saving, setSaving] = useState(false);
const [error, setError] = useState("");
const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    setBoardColumns(columns);
  }, [columns]);

  const allOrders = useMemo(
    () => boardColumns.flatMap((column) => column.orders),
    [boardColumns]
  );

  const normalizedSearchQuery = searchQuery.trim().toLowerCase();

const visibleColumns = useMemo(() => {
  if (!normalizedSearchQuery) {
    return boardColumns;
  }

  return boardColumns.map((column) => ({
    ...column,
    orders: column.orders.filter((order) =>
      [
        order.orderNumber,
        order.poNumber || "",
        order.customerName,
        order.customerEmail,
        order.status,
        order.priority,
        order.overallProductionStatus,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedSearchQuery)
    ),
  }));
}, [boardColumns, normalizedSearchQuery]);

  function findOrder(orderId: string) {
    return allOrders.find((order) => order.id === orderId) || null;
  }

  function createDragPreview(event: DragEvent<HTMLDivElement>) {
    const source = event.currentTarget;
    const rect = source.getBoundingClientRect();
    const preview = source.cloneNode(true) as HTMLElement;

    preview.style.position = "fixed";
    preview.style.top = "-1000px";
    preview.style.left = "-1000px";
    preview.style.width = `${rect.width}px`;
    preview.style.pointerEvents = "none";
    preview.style.opacity = "0.96";
    preview.style.transform = "rotate(2deg)";
    preview.style.boxShadow =
      "0 20px 45px rgba(15, 23, 42, 0.28), 0 8px 18px rgba(15, 23, 42, 0.18)";
    preview.style.zIndex = "999999";
    preview.style.background = "white";

    document.body.appendChild(preview);

    event.dataTransfer.setDragImage(
      preview,
      Math.min(40, rect.width / 2),
      32
    );

    window.setTimeout(() => {
      preview.remove();
    }, 0);
  }

  function handleDragStart(
    event: DragEvent<HTMLDivElement>,
    orderId: string
  ) {
    setDraggedOrderId(orderId);
    setDragOverDay("");
    setError("");

    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", orderId);

    createDragPreview(event);
  }

  function handleDragEnd() {
    setDraggedOrderId("");
    setDragOverDay("");
  }

  function handleDragOver(
    event: DragEvent<HTMLDivElement>,
    targetDay: ScheduleDay
  ) {
    event.preventDefault();

    if (!draggedOrderId) return;

    event.dataTransfer.dropEffect = "move";
    setDragOverDay(targetDay);
  }

  function handleDragLeave(event: DragEvent<HTMLDivElement>) {
    const nextTarget = event.relatedTarget;

    if (
      nextTarget instanceof Node &&
      event.currentTarget.contains(nextTarget)
    ) {
      return;
    }

    setDragOverDay("");
  }

  function updateOrderOnBoard(updatedOrder: ScheduledOrder) {
    setBoardColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        orders:
          (updatedOrder.weeklyScheduleDay || "UNSCHEDULED") === column.key
            ? [
                ...column.orders.filter((order) => order.id !== updatedOrder.id),
                updatedOrder,
              ]
            : column.orders.filter((order) => order.id !== updatedOrder.id),
      }))
    );
  }

  async function handleDrop(
    event: DragEvent<HTMLDivElement>,
    targetDay: ScheduleDay
  ) {
    event.preventDefault();

    if (!draggedOrderId || saving) return;

    const order = findOrder(draggedOrderId);

    setDraggedOrderId("");
    setDragOverDay("");

    if (!order) return;

    const nextScheduleDay = targetDay === "UNSCHEDULED" ? null : targetDay;

    if ((order.weeklyScheduleDay || null) === nextScheduleDay) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/orders/${order.id}/schedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          weeklyScheduleDay: nextScheduleDay,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to schedule order.");
        return;
      }

      const updatedOrder = normalizeReturnedOrder(order, data);
      updateOrderOnBoard(updatedOrder);
      router.refresh();
    } catch (moveError) {
      console.error(moveError);
      setError("Failed to schedule order.");
    } finally {
      setSaving(false);
    }
  }

  function getColumnClasses(columnKey: ScheduleDay) {
    if (!draggedOrderId) {
      return "border-slate-200 bg-white/70";
    }

    if (dragOverDay === columnKey) {
      return "border-slate-400 bg-slate-100 ring-2 ring-slate-300 shadow-md";
    }

    return "border-slate-200 bg-white/80";
  }

    function syncHorizontalScroll(source: "top" | "board") {
    const topScroll = topScrollRef.current;
    const boardScroll = boardScrollRef.current;

    if (!topScroll || !boardScroll) return;

    if (source === "top") {
      boardScroll.scrollLeft = topScroll.scrollLeft;
      return;
    }

    topScroll.scrollLeft = boardScroll.scrollLeft;
  }

  return (
    <>
      {error ? (
        <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
          {error}
        </div>
      ) : null}

      {draggedOrderId ? (
        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
          <span className="font-semibold text-slate-900">Dragging order:</span>{" "}
          Drop it into a weekday bucket or back into Unscheduled Orders.
        </div>
      ) : null}

      {saving ? (
        <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-700">
          Saving schedule...
        </div>
      ) : null}

      <div>
        {saving ? (
  <div className="mb-4 rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm font-medium text-blue-700">
    Saving schedule...
  </div>
) : null}

<div className="mb-4">
  <label className="mb-1 block text-sm font-medium">Search Orders</label>
  <input
    type="text"
    value={searchQuery}
    onChange={(event) => setSearchQuery(event.target.value)}
    className="w-full rounded-lg border bg-white px-3 py-2"
    placeholder="Search order #, PO #, customer, email, status, priority..."
  />
</div>

<div
  ref={topScrollRef}
  onScroll={() => syncHorizontalScroll("top")}
  className="mb-3 overflow-x-auto pb-2"
>
  <div className="h-1 min-w-[1600px]" />
</div>

<div
  ref={boardScrollRef}
  onScroll={() => syncHorizontalScroll("board")}
  className="overflow-x-auto pb-3"
>
        <div className="grid min-w-[1600px] grid-cols-8 gap-4">
          {visibleColumns.map((column) => (
            <div
              key={column.key}
              onDragOver={(event) => handleDragOver(event, column.key)}
              onDragLeave={handleDragLeave}
              onDrop={(event) => handleDrop(event, column.key)}
              className={`rounded-2xl border p-3 transition-all duration-150 ${getColumnClasses(
                column.key
              )}`}
            >
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
                  {column.label}
                </h3>

                <span className="rounded-full border bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {column.orders.length}
                </span>
              </div>

              <div className="min-h-[160px] space-y-3">
                {column.orders.length === 0 ? (
                  <div
                    className={`rounded-xl border border-dashed p-4 text-center text-xs transition ${
                      draggedOrderId
                        ? "bg-white text-slate-600"
                        : "bg-white/60 text-slate-400"
                    }`}
                  >
                    {draggedOrderId ? "Release to schedule here" : "Drop here"}
                  </div>
                ) : (
                  column.orders.map((order) => (
                    <div
                      key={order.id}
                      draggable={!saving}
                      onDragStart={(event) => handleDragStart(event, order.id)}
                      onDragEnd={handleDragEnd}
                      aria-grabbed={draggedOrderId === order.id}
                      className={`select-none rounded-xl border bg-white p-3 shadow-sm transition-all duration-150 ${
                        draggedOrderId === order.id
                          ? "scale-[0.98] opacity-40 ring-2 ring-slate-300"
                          : "cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                        <span>Drag to schedule</span>
                        <span className="text-slate-300">⋮⋮</span>
                      </div>

                      <Link
                        href={`/admin/production/${order.id}`}
                        className="block"
                      >
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-sm font-semibold text-slate-900">
                              {order.orderNumber}
                            </p>

                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getOrderStatusClasses(
                                order.status
                              )}`}
                            >
                              {order.status.replaceAll("_", " ")}
                            </span>

                            <span
                              className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPriorityClasses(
                                order.priority
                              )}`}
                            >
                              {formatPriorityLabel(order.priority)}
                            </span>
                          </div>

                          <div className="min-w-0 space-y-1 text-xs text-slate-500">
                            <p>PO # {order.poNumber || "—"}</p>
                            <p>{order.customerName}</p>
                            <p className="break-all">
  {order.customerEmail}
</p>
                            <p>Qty {order.quantity}</p>
                            <p>Due {formatDate(order.dueDate)}</p>
                            <p>Production: {order.overallProductionStatus.replaceAll("_", " ")}</p>
                            <p className="font-semibold text-slate-700">
                              {formatCurrency(order.total)}
                            </p>
                          </div>
                        </div>
                      </Link>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
</div>
      </div>
    </>
  );
}