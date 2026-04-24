import Link from "next/link";
import {
  Prisma,
  OrderPriority,
  ProductionOverallStatus,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    pickedUp?: string;
    overdue?: string;
  }>;
};

type ProductionLineRow = {
  id: string;
  partNumber: string;
  frameNeeded: string;
  quantity: number;
  bodyLeather: string | null;
  dueDate: Date | null;
  priority: OrderPriority;
  currentStatus: ProductionOverallStatus;
  lineNotes: string | null;

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

  upholsteryAssignedTo: string | null;
  upholsteredAssignedTo: string | null;
  finalAssemblyAssignedTo: string | null;
  qcAssignedTo: string | null;

  pickedUp: boolean;
  pickedUpAt: Date | null;
  updatedAt: Date;

  order: {
    id: string;
    orderNumber: string;
    poNumber: string | null;
    customerName: string;
    status: string;
    overallProductionStatus: ProductionOverallStatus;
  };
};

const productionStatusOptions: readonly ProductionOverallStatus[] = [
  "NEW",
  "WAITING_ON_LEATHER",
  "CUTTING",
  "SEWING",
  "UPHOLSTERY",
  "FINAL_ASSEMBLY",
  "QC",
  "READY",
  "PICKED_UP",
  "BLOCKED",
];

const statusOptions: readonly ["ALL", ...ProductionOverallStatus[]] = [
  "ALL",
  ...productionStatusOptions,
];

const priorityUiOptions = ["ALL", "NORMAL", "RUSH", "HOT"] as const;
type PriorityUiFilter = (typeof priorityUiOptions)[number];

type PickedUpFilter = "ALL" | "yes" | "no";
type OverdueFilter = "yes" | "no";

const pickedUpOptions: readonly PickedUpFilter[] = ["ALL", "yes", "no"];

function normalizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] || "";
  }

  return value || "";
}

function normalizeStatusFilter(value: string): "ALL" | ProductionOverallStatus {
  const normalized = value.trim().toUpperCase();

  if (normalized === "ALL") {
    return "ALL";
  }

  return productionStatusOptions.includes(normalized as ProductionOverallStatus)
    ? (normalized as ProductionOverallStatus)
    : "ALL";
}

function normalizePriorityFilter(value: string): PriorityUiFilter {
  const normalized = value.trim().toUpperCase();

  if (priorityUiOptions.includes(normalized as PriorityUiFilter)) {
    return normalized as PriorityUiFilter;
  }

  return "ALL";
}

function normalizePickedUpFilter(value: string): PickedUpFilter {
  const normalized = value.trim().toLowerCase();

  if (normalized === "yes" || normalized === "no") {
    return normalized;
  }

  return "ALL";
}

function normalizeOverdueFilter(value: string): OverdueFilter {
  return value.trim().toLowerCase() === "yes" ? "yes" : "no";
}

function formatDateOnly(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
  }).format(date);
}

function formatDateTime(date: Date | null) {
  if (!date) return "—";

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatPriorityLabel(priority: OrderPriority) {
  return priority === "HOLD" ? "HOT" : priority;
}

function getStatusClasses(status: ProductionOverallStatus) {
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

function getCurrentAssignee(line: ProductionLineRow) {
  return (
    line.qcAssignedTo ||
    line.finalAssemblyAssignedTo ||
    line.upholsteredAssignedTo ||
    line.upholsteryAssignedTo ||
    ""
  );
}

function getStageSummary(line: ProductionLineRow) {
  const stages = [
    { label: "Mill First", value: line.millFirstStatus },
    { label: "Leather Ordered", value: line.leatherOrderedStatus },
    { label: "Mill", value: line.millStatus },
    { label: "Frame Assembly", value: line.frameAssemblyStatus },
    { label: "Leather Arrived", value: line.leatherArrivedStatus },
    { label: "LEA CUT", value: line.leaCutStatus },
    { label: "Sewn", value: line.sewnStatus },
    { label: "Upholstery", value: line.upholsteryStatus },
    { label: "Upholstered", value: line.upholsteredStatus },
    { label: "Final Assembly", value: line.finalAssemblyStatus },
    { label: "QC", value: line.qcStatus },
  ];

  const activeStage =
    stages.find((stage) => stage.value === "IN_PROGRESS") ||
    [...stages].reverse().find((stage) => stage.value === "DONE") ||
    stages[0];

  return `${activeStage.label}: ${activeStage.value.replaceAll("_", " ")}`;
}

export default async function AdminProductionPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const q = normalizeQueryValue(params.q).trim();
  const status = normalizeStatusFilter(normalizeQueryValue(params.status));
  const priorityUi = normalizePriorityFilter(normalizeQueryValue(params.priority));
  const priority = priorityUi === "HOT" ? "HOLD" : priorityUi;
  const pickedUp = normalizePickedUpFilter(normalizeQueryValue(params.pickedUp));
  const overdue = normalizeOverdueFilter(normalizeQueryValue(params.overdue));
  const now = new Date();

  const orFilters: Prisma.ProductionLineWhereInput[] = [];
  const andFilters: Prisma.ProductionLineWhereInput[] = [];

  if (q) {
    orFilters.push(
      { partNumber: { contains: q, mode: "insensitive" } },
      { frameNeeded: { contains: q, mode: "insensitive" } },
      { bodyLeather: { contains: q, mode: "insensitive" } },
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { order: { customerName: { contains: q, mode: "insensitive" } } },
      { order: { poNumber: { contains: q, mode: "insensitive" } } }
    );
  }

  if (status !== "ALL") {
    andFilters.push({ currentStatus: status });
  }

  if (priority !== "ALL") {
    andFilters.push({ priority });
  }

  if (pickedUp === "yes") {
    andFilters.push({ pickedUp: true });
  } else if (pickedUp === "no") {
    andFilters.push({ pickedUp: false });
  }

  if (overdue === "yes") {
    andFilters.push(
      { dueDate: { lt: now } },
      { pickedUp: false },
      {
        currentStatus: {
          notIn: ["READY", "PICKED_UP"],
        },
      }
    );
  }

  const where: Prisma.ProductionLineWhereInput = {
    ...(orFilters.length > 0 ? { OR: orFilters } : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };

  const [totalLines, overdueLines, blockedLines, readyLines, pickedUpLines, lines] =
    await Promise.all([
      prisma.productionLine.count(),
      prisma.productionLine.count({
        where: {
          dueDate: { lt: now },
          pickedUp: false,
          currentStatus: {
            notIn: ["READY", "PICKED_UP"],
          },
        },
      }),
      prisma.productionLine.count({
        where: { currentStatus: "BLOCKED" },
      }),
      prisma.productionLine.count({
        where: { currentStatus: "READY" },
      }),
      prisma.productionLine.count({
        where: { pickedUp: true },
      }),
      prisma.productionLine.findMany({
        where,
        orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              poNumber: true,
              customerName: true,
              status: true,
              overallProductionStatus: true,
            },
          },
        },
        take: 150,
      }),
    ]);

  const typedLines = lines as ProductionLineRow[];
  const nowTime = now.getTime();

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Production
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                Factory production dashboard
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Monitor every production line across the factory, filter by
                stage, and jump directly into the order detail page to update
                progress.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin/orders" className="button-secondary">
                Orders
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
              Total Lines
            </p>
            <p className="mt-3 text-4xl font-bold">{totalLines}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Overdue
            </p>
            <p className="mt-3 text-4xl font-bold">{overdueLines}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Blocked
            </p>
            <p className="mt-3 text-4xl font-bold">{blockedLines}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Ready
            </p>
            <p className="mt-3 text-4xl font-bold">{readyLines}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Picked Up
            </p>
            <p className="mt-3 text-4xl font-bold">{pickedUpLines}</p>
          </div>
        </section>

        <section className="mt-8 section-card-strong">
          <form
            method="GET"
            className="grid gap-4 lg:grid-cols-[1.4fr_repeat(4,0.7fr)_auto]"
          >
            <div>
              <label className="mb-1 block text-sm font-medium">Search</label>
              <input
                type="text"
                name="q"
                defaultValue={q}
                className="w-full rounded-lg border px-3 py-2"
                placeholder="PO #, customer, order #, part #, frame needed..."
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Status</label>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-lg border px-3 py-2"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Priority</label>
              <select
                name="priority"
                defaultValue={priorityUi}
                className="w-full rounded-lg border px-3 py-2"
              >
                {priorityUiOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Picked Up</label>
              <select
                name="pickedUp"
                defaultValue={pickedUp}
                className="w-full rounded-lg border px-3 py-2"
              >
                {pickedUpOptions.map((option) => (
                  <option key={option} value={option}>
                    {option === "ALL" ? "ALL" : option}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Overdue Only
              </label>
              <select
                name="overdue"
                defaultValue={overdue}
                className="w-full rounded-lg border px-3 py-2"
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div className="flex items-end gap-2">
              <button type="submit" className="button-primary">
                Apply
              </button>
              <Link href="/admin/production" className="button-secondary">
                Reset
              </Link>
            </div>
          </form>
        </section>

        <section className="mt-8 section-card-strong">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Production Lines
              </p>
              <h2 className="mt-2 text-3xl font-bold">Live factory view</h2>
            </div>

            <span className="status-pill">
              Showing {typedLines.length} line{typedLines.length === 1 ? "" : "s"}
            </span>
          </div>

          {typedLines.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                No production lines match these filters.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Try resetting the filters or send more orders to factory.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 xl:grid-cols-2">
              {typedLines.map((line) => {
                const currentAssignee = getCurrentAssignee(line);
                const isOverdue =
                  Boolean(line.dueDate) &&
                  !line.pickedUp &&
                  !["READY", "PICKED_UP"].includes(line.currentStatus) &&
                  (line.dueDate?.getTime() ?? 0) < nowTime;

                return (
                  <Link
                    key={line.id}
                    href={`/admin/orders/${line.order.id}`}
                    className="premium-grid-card"
                  >
                    <div className="flex flex-col gap-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-lg font-semibold">
                              {line.partNumber} / {line.frameNeeded}
                            </p>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStatusClasses(
                                line.currentStatus
                              )}`}
                            >
                              {line.currentStatus.replaceAll("_", " ")}
                            </span>
                            <span
                              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getPriorityClasses(
                                line.priority
                              )}`}
                            >
                              {formatPriorityLabel(line.priority)}
                            </span>
                            {line.pickedUpAt ? (
                              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold bg-purple-50 text-purple-700 border-purple-200">
                                Picked Up {formatDateOnly(line.pickedUpAt)}
                              </span>
                            ) : null}
                            {isOverdue ? (
                              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold bg-red-50 text-red-700 border-red-200">
                                Overdue
                              </span>
                            ) : null}
                          </div>

                          <p className="mt-2 text-sm text-slate-500">
                            Order {line.order.orderNumber}
                            {line.order.poNumber ? ` · PO # ${line.order.poNumber}` : ""}
                          </p>
                          <p className="text-sm text-slate-500">
                            {line.order.customerName}
                          </p>
                        </div>

                        <div className="sm:text-right">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Quantity
                          </p>
                          <p className="mt-1 text-2xl font-bold text-slate-900">
                            {line.quantity}
                          </p>
                        </div>
                      </div>

                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Due Date
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {formatDateOnly(line.dueDate)}
                          </p>
                        </div>

                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Body Leather
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {line.bodyLeather || "—"}
                          </p>
                        </div>

                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Current Assignee
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {currentAssignee || "—"}
                          </p>
                        </div>

                        <div className="soft-panel">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Last Updated
                          </p>
                          <p className="mt-2 font-semibold text-slate-900">
                            {formatDateTime(line.updatedAt)}
                          </p>
                        </div>
                      </div>

                      <div className="rounded-xl border bg-white/80 p-3">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Stage Summary
                        </p>
                        <p className="mt-2 text-sm text-slate-700">
                          {getStageSummary(line)}
                        </p>
                      </div>

                      {line.lineNotes ? (
                        <div className="rounded-xl border bg-white/80 p-3">
                          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                            Line Notes
                          </p>
                          <p className="mt-2 text-sm text-slate-600">
                            {line.lineNotes}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}