import Link from "next/link";
import {
  Prisma,
  OrderPriority,
  OrderStatus,
  ProductionOverallStatus,
} from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import {
  formatCentralDate,
  formatCentralDateTime,
} from "../../../lib/central-time";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    status?: string;
    priority?: string;
    overdue?: string;
    stages?: string;
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
  order: {
    id: string;
    orderNumber: string;
    poNumber: string | null;
    customerName: string;
    status: OrderStatus;
    overallProductionStatus: ProductionOverallStatus;
  };
};

const orderStatusOptions: readonly OrderStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "CHANGED",
  "SENT_TO_FACTORY",
  "COMPLETED",
  "PAID",
  "CANCELLED",
];

type StatusFilter = "ALL_ACTIVE" | OrderStatus;

const statusOptions: readonly StatusFilter[] = [
  "ALL_ACTIVE",
  ...orderStatusOptions,
];

const priorityUiOptions = ["ALL", "NORMAL", "RUSH", "HOT"] as const;
type PriorityUiFilter = (typeof priorityUiOptions)[number];

type OverdueFilter = "yes" | "no";

type StageFilterKey =
  | "millFirstStatus"
  | "leatherOrderedStatus"
  | "millStatus"
  | "frameAssemblyStatus"
  | "leatherArrivedStatus"
  | "leaCutStatus"
  | "sewnStatus"
  | "upholsteryStatus"
  | "upholsteredStatus"
  | "finalAssemblyStatus"
  | "qcStatus";

const completedStageOptions: readonly {
  key: StageFilterKey;
  label: string;
}[] = [
  { key: "millFirstStatus", label: "Mill First" },
  { key: "leatherOrderedStatus", label: "Leather Ordered" },
  { key: "millStatus", label: "Mill" },
  { key: "frameAssemblyStatus", label: "Frame Assembly" },
  { key: "leatherArrivedStatus", label: "Leather Arrived" },
  { key: "leaCutStatus", label: "LEA Cut" },
  { key: "sewnStatus", label: "Sewn" },
  { key: "upholsteryStatus", label: "Upholstery" },
  { key: "upholsteredStatus", label: "Upholstered" },
  { key: "finalAssemblyStatus", label: "Final Assembly" },
  { key: "qcStatus", label: "QC'ED" },
];

const kanbanColumns: readonly {
  key: ProductionOverallStatus;
  label: string;
}[] = [
  { key: "NEW", label: "New" },
  { key: "WAITING_ON_LEATHER", label: "Waiting on Leather" },
  { key: "CUTTING", label: "Cutting" },
  { key: "SEWING", label: "Sewing" },
  { key: "UPHOLSTERY", label: "Upholstery" },
  { key: "FINAL_ASSEMBLY", label: "Final Assembly" },
  { key: "QC", label: "QC" },
  { key: "READY", label: "Ready" },
  { key: "PICKED_UP", label: "Picked Up" },
  { key: "BLOCKED", label: "Blocked" },
];

function normalizeQueryValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || "";
  return value || "";
}

function normalizeStatusFilter(value: string): StatusFilter {
  const normalized = value.trim().toUpperCase();

  if (normalized === "ALL_ACTIVE" || normalized === "ALL") {
    return "ALL_ACTIVE";
  }

  return orderStatusOptions.includes(normalized as OrderStatus)
    ? (normalized as OrderStatus)
    : "ALL_ACTIVE";
}

function normalizePriorityFilter(value: string): PriorityUiFilter {
  const normalized = value.trim().toUpperCase();

  if (priorityUiOptions.includes(normalized as PriorityUiFilter)) {
    return normalized as PriorityUiFilter;
  }

  return "ALL";
}

function normalizeOverdueFilter(value: string): OverdueFilter {
  return value.trim().toLowerCase() === "yes" ? "yes" : "no";
}

function normalizeSelectedStages(value: string) {
  const allowed = completedStageOptions.map((stage) => stage.key);

  return value
    .split(",")
    .map((stage) => stage.trim())
    .filter((stage): stage is StageFilterKey =>
      allowed.includes(stage as StageFilterKey)
    );
}

function formatDateOnly(date: Date | null) {
  if (!date) return "—";
  return formatCentralDate(date);
}

function formatDateTime(date: Date | null) {
  if (!date) return "—";
  return formatCentralDateTime(date);
}

function formatPriorityLabel(priority: OrderPriority) {
  return priority === "HOLD" ? "HOT" : priority;
}

function formatStageLabel(value: string) {
  switch (value) {
    case "NOT_STARTED":
      return "Not Started";
    case "HOT":
      return "Hot";
    case "IN_PROGRESS":
      return "In Progress";
    case "FRAME_DONE":
      return "Frame Done";
    case "THIS_WEEK":
      return "This Week";
    case "DONE":
      return "Done";
    case "MISSING_LEATHER":
      return "Missing Leather";
    case "BLOCKED":
      return "Blocked";
    case "NA":
      return "N/A";
    default:
      return value.replaceAll("_", " ");
  }
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

function getStageValueClasses(value: string) {
  switch (value) {
    case "DONE":
      return "bg-emerald-100 text-emerald-800 border-emerald-300";
    case "HOT":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "IN_PROGRESS":
      return "bg-lime-50 text-lime-800 border-lime-200";
    case "FRAME_DONE":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "THIS_WEEK":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "MISSING_LEATHER":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "BLOCKED":
      return "bg-red-100 text-red-800 border-red-300";
    case "NA":
      return "bg-slate-100 text-slate-600 border-slate-200";
    default:
      return "bg-red-50 text-red-700 border-red-200";
  }
}

function getCurrentAssignee(line: ProductionLineRow) {
  return (
    line.qcAssignedTo ||
    line.upholsteredAssignedTo ||
    line.leaCutAssignedTo ||
    ""
  );
}

function getStageSummary(line: ProductionLineRow) {
  const stages = [
    { label: "MILL FIRST", value: line.millFirstStatus },
    { label: "Leather Ordered", value: line.leatherOrderedStatus },
    { label: "MILL", value: line.millStatus },
    { label: "Frame Assembly", value: line.frameAssemblyStatus },
    { label: "Leather Arrived", value: line.leatherArrivedStatus },
    { label: "LEA CUT", value: line.leaCutStatus },
    { label: "Sewn", value: line.sewnStatus },
    { label: "Upholstery", value: line.upholsteryStatus },
    { label: "Upholstered", value: line.upholsteredStatus },
    { label: "Final Assembly", value: line.finalAssemblyStatus },
    { label: "QC'ED", value: line.qcStatus },
  ];

  const activeStage =
    stages.find((stage) =>
      ["HOT", "IN_PROGRESS", "FRAME_DONE", "THIS_WEEK", "MISSING_LEATHER"].includes(
        stage.value
      )
    ) ||
    [...stages].reverse().find((stage) => stage.value === "DONE") ||
    stages[0];

  return activeStage;
}

function formatStatusOptionLabel(option: StatusFilter) {
  if (option === "ALL_ACTIVE") return "ALL ACTIVE";
  return option.replaceAll("_", " ");
}

function buildStageHref({
  q,
  status,
  priority,
  overdue,
  selectedStages,
  stage,
}: {
  q: string;
  status: StatusFilter;
  priority: PriorityUiFilter;
  overdue: OverdueFilter;
  selectedStages: StageFilterKey[];
  stage: StageFilterKey;
}) {
  const nextStages = selectedStages.includes(stage)
    ? selectedStages.filter((item) => item !== stage)
    : [...selectedStages, stage];

  const params = new URLSearchParams();

  if (q) params.set("q", q);
  if (status !== "ALL_ACTIVE") params.set("status", status);
  if (priority !== "ALL") params.set("priority", priority);
  if (overdue === "yes") params.set("overdue", overdue);
  if (nextStages.length > 0) params.set("stages", nextStages.join(","));

  const queryString = params.toString();

  return queryString ? `/admin/production?${queryString}` : "/admin/production";
}

export default async function AdminProductionPage({
  searchParams,
}: PageProps) {
  const params = await searchParams;

  const q = normalizeQueryValue(params.q).trim();
  const status = normalizeStatusFilter(normalizeQueryValue(params.status));
  const priorityUi = normalizePriorityFilter(normalizeQueryValue(params.priority));
  const priority = priorityUi === "HOT" ? "HOLD" : priorityUi;
  const overdue = normalizeOverdueFilter(normalizeQueryValue(params.overdue));
  const selectedStages = normalizeSelectedStages(
    normalizeQueryValue(params.stages)
  );
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

  if (status === "ALL_ACTIVE") {
    andFilters.push({
      order: {
        status: {
          notIn: ["PAID", "CANCELLED"],
        },
      },
    });
  } else {
    andFilters.push({
      order: {
        status,
      },
    });
  }

  if (priority !== "ALL") {
    andFilters.push({ priority });
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

  for (const stage of selectedStages) {
    andFilters.push({
      [stage]: "DONE",
    } as Prisma.ProductionLineWhereInput);
  }

  const where: Prisma.ProductionLineWhereInput = {
    ...(orFilters.length > 0 ? { OR: orFilters } : {}),
    ...(andFilters.length > 0 ? { AND: andFilters } : {}),
  };

  const activeOrderFilter: Prisma.ProductionLineWhereInput = {
    order: {
      status: {
        notIn: ["PAID", "CANCELLED"],
      },
    },
  };

  const [totalLines, overdueLines, blockedLines, readyLines, pickedUpLines, lines] =
    await Promise.all([
      prisma.productionLine.count({
        where: activeOrderFilter,
      }),
      prisma.productionLine.count({
        where: {
          AND: [
            activeOrderFilter,
            { dueDate: { lt: now } },
            { pickedUp: false },
            {
              currentStatus: {
                notIn: ["READY", "PICKED_UP"],
              },
            },
          ],
        },
      }),
      prisma.productionLine.count({
        where: {
          AND: [activeOrderFilter, { currentStatus: "BLOCKED" }],
        },
      }),
      prisma.productionLine.count({
        where: {
          AND: [activeOrderFilter, { currentStatus: "READY" }],
        },
      }),
      prisma.productionLine.count({
        where: {
          AND: [activeOrderFilter, { pickedUp: true }],
        },
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
        take: 200,
      }),
    ]);

  const typedLines = lines as ProductionLineRow[];
  const nowTime = now.getTime();

  const groupedLines = kanbanColumns.map((column) => ({
    ...column,
    lines: typedLines.filter((line) => line.currentStatus === column.key),
  }));

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
                Factory Kanban Dashboard
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Filter by order status and completed production stages, then
                review each line by production status.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
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
              Total Active Lines
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
          <form method="GET" className="grid gap-4 lg:grid-cols-[1.4fr_repeat(3,0.7fr)_auto]">
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
              <label className="mb-1 block text-sm font-medium">
                Order Status
              </label>
              <select
                name="status"
                defaultValue={status}
                className="w-full rounded-lg border px-3 py-2"
              >
                {statusOptions.map((option) => (
                  <option key={option} value={option}>
                    {formatStatusOptionLabel(option)}
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

            <input
              type="hidden"
              name="stages"
              value={selectedStages.join(",")}
            />

            <div className="flex items-end gap-2">
              <button type="submit" className="button-primary">
                Apply
              </button>
              <Link href="/admin/production" className="button-secondary">
                Reset
              </Link>
            </div>
          </form>

          <div className="mt-6 border-t pt-6">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Completed Stage Filters
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  Select one or more stages. A line must have every selected
                  stage marked as DONE.
                </p>
              </div>

              {selectedStages.length > 0 ? (
                <Link href="/admin/production" className="button-secondary">
                  Clear Stage Filters
                </Link>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {completedStageOptions.map((stage) => {
                const selected = selectedStages.includes(stage.key);

                return (
                  <Link
                    key={stage.key}
                    href={buildStageHref({
                      q,
                      status,
                      priority: priorityUi,
                      overdue,
                      selectedStages,
                      stage: stage.key,
                    })}
                    className={`rounded-xl border px-3 py-2 text-sm font-medium ${
                      selected
                        ? "bg-[var(--brand)] text-white"
                        : "bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {stage.label}
                    {selected ? " ✓" : ""}
                  </Link>
                );
              })}
            </div>
          </div>
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
        const stageSummary = getStageSummary(line);

        return (
          <Link
            key={line.id}
            href={`/admin/production/${line.order.id}`}
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
                      className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getOrderStatusClasses(
                        line.order.status
                      )}`}
                    >
                      {line.order.status.replaceAll("_", " ")}
                    </span>

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

              {line.completedPhotoUrl ? (
                <div className="overflow-hidden rounded-xl border bg-white">
                  <img
                    src={line.completedPhotoUrl}
                    alt={`${line.partNumber} completed`}
                    className="h-52 w-full object-cover"
                  />
                </div>
              ) : null}

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
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Stage Summary
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStageValueClasses(
                      stageSummary.value
                    )}`}
                  >
                    {formatStageLabel(stageSummary.value)}
                  </span>
                </div>
                <p className="mt-2 text-sm text-slate-700">
                  {stageSummary.label}
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