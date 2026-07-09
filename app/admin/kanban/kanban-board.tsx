"use client";

import Link from "next/link";
import { type DragEvent, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";


type ProductionOverallStatus =
  | "NEW"
  | "WAITING_ON_LEATHER"
  | "CUTTING"
  | "SEWING"
  | "UPHOLSTERY"
  | "FINAL_ASSEMBLY"
  | "QC"
  | "READY"
  | "PICKED_UP"
  | "BLOCKED";

type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CHANGED"
  | "SENT_TO_FACTORY"
  | "COMPLETED"
  | "PAID"
  | "CANCELLED";

type OrderPriority = "NORMAL" | "RUSH" | "HOLD";

type KanbanLine = {
  id: string;
  partNumber: string;
  frameNeeded: string;
  quantity: number;
  bodyLeather: string | null;
  dueDate: string | null;
  priority: OrderPriority;
  currentStatus: ProductionOverallStatus;
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
  pickedUpAt: string | null;
  updatedAt: string;

  order: {
    id: string;
    orderNumber: string;
    poNumber: string | null;
    customerName: string;
    status: OrderStatus;
    overallProductionStatus: ProductionOverallStatus;
  };
};

type KanbanColumn = {
  key: ProductionOverallStatus;
  label: string;
  lines: KanbanLine[];
};

type PendingMove = {
  line: KanbanLine;
  targetStatus: ProductionOverallStatus;
};

type Props = {
  columns: KanbanColumn[];
  nowIso: string;
};

const productionStatusOrder: ProductionOverallStatus[] = [
  "NEW",
  "WAITING_ON_LEATHER",
  "CUTTING",
  "SEWING",
  "UPHOLSTERY",
  "FINAL_ASSEMBLY",
  "QC",
  "READY",
  "PICKED_UP",
];

function formatPriorityLabel(priority: OrderPriority) {
  return priority === "HOLD" ? "HOT" : priority;
}

function getOrderStatusClasses(status: OrderStatus) {
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

function getPriorityClasses(priority: OrderPriority) {
  switch (priority) {
    case "RUSH":
      return "bg-red-50 text-red-700 border-red-200";
    case "HOLD":
      return "bg-orange-50 text-orange-700 border-orange-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function getStatusLabel(status: ProductionOverallStatus) {
  return status.replaceAll("_", " ");
}

function getDoneStagesForTarget(targetStatus: ProductionOverallStatus) {
  const preProduction = [
    "Mill First",
    "Leather Ordered",
    "Mill",
    "Frame Assembly",
    "Leather Arrived",
  ];

  switch (targetStatus) {
    case "WAITING_ON_LEATHER":
      return preProduction;
    case "CUTTING":
      return [...preProduction, "LEA Cut"];
    case "SEWING":
      return [...preProduction, "LEA Cut", "Sewn"];
    case "UPHOLSTERY":
      return [...preProduction, "LEA Cut", "Sewn", "Upholstery", "Upholstered"];
    case "FINAL_ASSEMBLY":
      return [
        ...preProduction,
        "LEA Cut",
        "Sewn",
        "Upholstery",
        "Upholstered",
        "Final Assembly",
      ];
    case "QC":
      return [
        ...preProduction,
        "LEA Cut",
        "Sewn",
        "Upholstery",
        "Upholstered",
        "Final Assembly",
      ];
    case "READY":
    case "PICKED_UP":
      return [
        ...preProduction,
        "LEA Cut",
        "Sewn",
        "Upholstery",
        "Upholstered",
        "Final Assembly",
        "QC'ED",
      ];
    default:
      return [];
  }
}

function canDragMove(
  currentStatus: ProductionOverallStatus,
  targetStatus: ProductionOverallStatus
) {
  if (currentStatus === targetStatus) {
    return {
      allowed: false,
      reason: "This line is already in that column.",
    };
  }

  if (currentStatus === "PICKED_UP") {
    return {
      allowed: false,
      reason:
        "Picked up lines cannot be moved by dragging. Open the production detail page if this was marked incorrectly.",
    };
  }

  if (currentStatus === "BLOCKED" && targetStatus !== "BLOCKED") {
    return {
      allowed: false,
      reason:
        "Blocked lines must be unblocked from the production detail page so the blocked dropdown can be cleared intentionally.",
    };
  }

  if (targetStatus === "BLOCKED") {
    return { allowed: true, reason: "" };
  }

  const fromIndex = productionStatusOrder.indexOf(currentStatus);
  const toIndex = productionStatusOrder.indexOf(targetStatus);

  if (fromIndex === -1 || toIndex === -1) {
    return {
      allowed: false,
      reason: "This move is not supported.",
    };
  }

  if (toIndex <= fromIndex) {
    return {
      allowed: false,
      reason:
        "Backward drag moves are disabled so completed production steps are not accidentally undone. Open the production detail page to move a line backward.",
    };
  }

  return { allowed: true, reason: "" };
}

function normalizeReturnedLine(original: KanbanLine, returnedLine: any) {
  return {
    ...original,
    ...returnedLine,
    dueDate: returnedLine?.dueDate || original.dueDate,
    pickedUpAt: returnedLine?.pickedUpAt || null,
    updatedAt: returnedLine?.updatedAt || new Date().toISOString(),
    order: original.order,
  } as KanbanLine;
}

export default function KanbanBoard({ columns, nowIso }: Props) {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
const [boardColumns, setBoardColumns] = useState(columns);
const [draggedLineId, setDraggedLineId] = useState("");
const [dragOverStatus, setDragOverStatus] =
  useState<ProductionOverallStatus | "">("");
const [pendingMove, setPendingMove] = useState<PendingMove | null>(null);
const [error, setError] = useState("");
const [saving, setSaving] = useState(false);

  useEffect(() => {
    setBoardColumns(columns);
  }, [columns]);

  useEffect(() => {
  setMounted(true);
}, []);

  const allLines = useMemo(
    () => boardColumns.flatMap((column) => column.lines),
    [boardColumns]
  );

  const nowTime = new Date(nowIso).getTime();

  function findLine(lineId: string) {
    return allLines.find((line) => line.id === lineId) || null;
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
  lineId: string
) {
  setDraggedLineId(lineId);
  setDragOverStatus("");
  setError("");

  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", lineId);

  createDragPreview(event);
}

function handleDragEnd() {
  setDraggedLineId("");
  setDragOverStatus("");
}

function handleDragOver(
  event: DragEvent<HTMLDivElement>,
  targetStatus: ProductionOverallStatus
) {
  event.preventDefault();

  if (!draggedLineId) return;

  event.dataTransfer.dropEffect = "move";
  setDragOverStatus(targetStatus);
}

function handleDragLeave(event: DragEvent<HTMLDivElement>) {
  const nextTarget = event.relatedTarget;

  if (
    nextTarget instanceof Node &&
    event.currentTarget.contains(nextTarget)
  ) {
    return;
  }

  setDragOverStatus("");
}

function getColumnDropClasses(columnKey: ProductionOverallStatus) {
  if (!draggedLineId) {
    return "border-slate-200 bg-white/70";
  }

  const line = findLine(draggedLineId);

  if (!line) {
    return "border-slate-200 bg-white/70";
  }

  const isActiveTarget = dragOverStatus === columnKey;
  const moveCheck = canDragMove(line.currentStatus, columnKey);

  if (isActiveTarget && moveCheck.allowed) {
    return "border-slate-400 bg-slate-100 ring-2 ring-slate-300 shadow-md";
  }

  if (isActiveTarget && !moveCheck.allowed) {
    return "border-red-300 bg-red-50 ring-2 ring-red-200";
  }

  if (moveCheck.allowed) {
    return "border-slate-200 bg-white/80";
  }

  return "border-slate-200 bg-white/50 opacity-80";
}

function handleDrop(
  event: DragEvent<HTMLDivElement>,
  targetStatus: ProductionOverallStatus
) {
  event.preventDefault();

  if (!draggedLineId) return;

  const line = findLine(draggedLineId);

  setDraggedLineId("");
  setDragOverStatus("");

  if (!line) return;

  const moveCheck = canDragMove(line.currentStatus, targetStatus);

  if (!moveCheck.allowed) {
    setError(moveCheck.reason);
    return;
  }

  setError("");
  setPendingMove({ line, targetStatus });
}

  function updateLineOnBoard(updatedLine: KanbanLine) {
    setBoardColumns((currentColumns) =>
      currentColumns.map((column) => ({
        ...column,
        lines:
          column.key === updatedLine.currentStatus
            ? [
                ...column.lines.filter((line) => line.id !== updatedLine.id),
                updatedLine,
              ]
            : column.lines.filter((line) => line.id !== updatedLine.id),
      }))
    );
  }

  async function confirmMove() {
    if (!pendingMove) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/production-lines/${pendingMove.line.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            moveToStatus: pendingMove.targetStatus,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to move production line.");
        return;
      }

      const updatedLine = normalizeReturnedLine(pendingMove.line, data);
      updateLineOnBoard(updatedLine);
      setPendingMove(null);
      router.refresh();
    } catch (moveError) {
      console.error(moveError);
      setError("Failed to move production line.");
    } finally {
      setSaving(false);
    }
  }

  const pendingDoneStages = pendingMove
    ? getDoneStagesForTarget(pendingMove.targetStatus)
    : [];

  return (
    <>
{error ? (
  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
    {error}
  </div>
) : null}

{draggedLineId ? (
  <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600 shadow-sm">
    <span className="font-semibold text-slate-900">Dragging order:</span>{" "}
    Drop it into a production column. You will still get a confirmation popup
    before anything is saved.
  </div>
) : null}

<div className="overflow-x-auto pb-3">
        <div className="grid min-w-[1800px] grid-cols-10 gap-4">
          {boardColumns.map((column) => (
<div
  key={column.key}
  onDragOver={(event) => handleDragOver(event, column.key)}
  onDragLeave={handleDragLeave}
  onDrop={(event) => handleDrop(event, column.key)}
  className={`rounded-2xl border p-3 transition-all duration-150 ${getColumnDropClasses(
    column.key
  )}`}
>
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold uppercase tracking-[0.12em] text-slate-700">
                  {column.label}
                </h3>
                <span className="rounded-full border bg-white px-2 py-1 text-xs font-semibold text-slate-600">
                  {column.lines.length}
                </span>
              </div>

              <div className="min-h-[120px] space-y-3">
{column.lines.length === 0 ? (
  <div
    className={`rounded-xl border border-dashed p-4 text-center text-xs transition ${
      draggedLineId
        ? "bg-white text-slate-600"
        : "bg-white/60 text-slate-400"
    }`}
  >
    {draggedLineId ? "Release to move here" : "Drop here"}
  </div>
) : (
                  column.lines.map((line) => {
                    const isOverdue =
                      Boolean(line.dueDate) &&
                      !line.pickedUp &&
                      !["READY", "PICKED_UP"].includes(line.currentStatus) &&
                      (line.dueDate ? new Date(line.dueDate).getTime() : 0) <
                        nowTime;

                    return (
<div
  key={line.id}
  draggable={!saving}
  onDragStart={(event) => handleDragStart(event, line.id)}
  onDragEnd={handleDragEnd}
  aria-grabbed={draggedLineId === line.id}
  className={`select-none rounded-xl border bg-white p-3 shadow-sm transition-all duration-150 ${
    draggedLineId === line.id
      ? "scale-[0.98] opacity-40 ring-2 ring-slate-300"
      : "cursor-grab hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing"
  }`}
>

  <div className="mb-2 flex items-center justify-between text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
  <span>Drag to move</span>
  <span className="text-slate-300">⋮⋮</span>
</div>
                        <Link
                          href={`/admin/production/${line.order.id}`}
                          className="block"
                        >
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <p className="text-sm font-semibold text-slate-900">
                                {line.partNumber} / {line.frameNeeded}
                              </p>

                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getOrderStatusClasses(
                                  line.order.status
                                )}`}
                              >
                                {line.order.status.replaceAll("_", " ")}
                              </span>

                              <span
                                className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${getPriorityClasses(
                                  line.priority
                                )}`}
                              >
                                {formatPriorityLabel(line.priority)}
                              </span>

                              {isOverdue ? (
                                <span className="inline-flex rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-[10px] font-semibold text-red-700">
                                  Overdue
                                </span>
                              ) : null}
                            </div>

                            <div className="space-y-1 text-xs text-slate-500">
                              <p>Order {line.order.orderNumber}</p>
                              <p>PO # {line.order.poNumber || "—"}</p>
                              <p>{line.order.customerName}</p>
                              <p>Qty {line.quantity}</p>
                            </div>
                          </div>
                        </Link>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

{mounted && pendingMove
  ? createPortal(
      <div className="fixed inset-0 z-[9999] flex items-start justify-center overflow-y-auto bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">
              Confirm Kanban Move
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              Move {pendingMove.line.order.orderNumber} to{" "}
              {getStatusLabel(pendingMove.targetStatus)}?
            </h2>

            <p className="mt-3 text-sm text-slate-600">
              Line:{" "}
              <span className="font-semibold">
                {pendingMove.line.partNumber} / {pendingMove.line.frameNeeded}
              </span>
            </p>

            {pendingMove.targetStatus === "BLOCKED" ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                This will mark the line as blocked. To unblock it later, open
                the production detail page and clear the blocked stage.
              </div>
            ) : (
              <div className="mt-4 rounded-xl border bg-slate-50 p-4">
                <p className="text-sm font-semibold text-slate-800">
                  This will mark these stages as DONE:
                </p>

                {pendingDoneStages.length > 0 ? (
                  <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-slate-600">
                    {pendingDoneStages.map((stage) => (
                      <li key={stage}>{stage}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">
                    No production dropdowns will be marked done.
                  </p>
                )}

                {pendingMove.targetStatus === "QC" ? (
                  <p className="mt-3 text-sm text-slate-500">
                    QC itself will be set to In Progress so the card stays in
                    the QC column. Moving to Ready will mark QC as DONE.
                  </p>
                ) : null}

                {pendingMove.targetStatus === "PICKED_UP" ? (
                  <p className="mt-3 text-sm text-slate-500">
                    The line will also be marked picked up using today’s date.
                  </p>
                ) : null}
              </div>
            )}

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                onClick={() => setPendingMove(null)}
                disabled={saving}
                className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={confirmMove}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving
                  ? "Moving..."
                  : `Move to ${getStatusLabel(pendingMove.targetStatus)}`}
              </button>
            </div>
          </div>
      </div>,
      document.body
    )
  : null}
    </>
  );
}