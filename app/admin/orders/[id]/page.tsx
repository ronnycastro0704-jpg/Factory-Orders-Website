import Link from "next/link";
import { prisma } from "../../../../lib/prisma";
import { formatCentralDate, formatCentralDateTime } from "../../../../lib/central-time";
import { formatCurrency } from "../../../../lib/utils";
import { notFound } from "next/navigation";
import EditOrderForm from "./edit-order-form";
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

type OrderRevisionItem = {
  id: string;
  revisionNumber: number;
  changeReason: string | null;
  changedBy: string | null;
  createdAt: Date;
};

type EmailLogItem = {
  id: string;
  eventType: string;
  status: string;
  recipient: string;
  subject: string | null;
  errorMessage: string | null;
  createdAt: Date;
};

type SheetSyncLogItem = {
  id: string;
  status: string;
  spreadsheetId: string | null;
  worksheetName: string | null;
  spreadsheetRowId: string | null;
  errorMessage: string | null;
  createdAt: Date;
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

function formatPriorityLabel(priority: string) {
  return priority === "HOLD" ? "HOT" : priority;
}

function formatStatusBadge(status: string) {
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
      emailLogs: {
        orderBy: { createdAt: "desc" },
      },
      sheetSyncLogs: {
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
  const typedRevisions = order.revisions as OrderRevisionItem[];
  const typedEmailLogs = order.emailLogs as EmailLogItem[];
  const typedSheetSyncLogs = order.sheetSyncLogs as SheetSyncLogItem[];
  const typedProductionLines = order.productionLines as ProductionLineItem[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-7xl space-y-8">
        <div className="flex flex-wrap gap-3">
          <Link href="/admin/production" className="button-secondary">
            Production
          </Link>
          <Link href="/admin/orders" className="button-secondary">
            Orders
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
              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200">
                {order.status.replaceAll("_", " ")}
              </span>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${formatStatusBadge(
                  order.overallProductionStatus
                )}`}
              >
                {order.overallProductionStatus.replaceAll("_", " ")}
              </span>
              <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200">
                Priority: {formatPriorityLabel(order.priority)}
              </span>
              {order.pickedUpAt ? (
                <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                  Picked Up {formatCentralDate(order.pickedUpAt)}
                </span>
              ) : null}
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-6 text-sm text-slate-500">
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
                {order.dueDate
                  ? formatCentralDate(order.dueDate)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em]">Picked Up</p>
              <p className="mt-1 text-slate-700">
                {order.pickedUpAt
                  ? formatCentralDate(order.pickedUpAt)
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.14em]">
                Production Lines
              </p>
              <p className="mt-1 text-slate-700">{typedProductionLines.length}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="space-y-8">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Edit Order</h2>
              <p className="mt-2 text-sm text-slate-500">
                Update customer details, notes, and status. Each save creates a
                revision.
              </p>

              <div className="mt-6">
                <EditOrderForm
                  orderId={order.id}
                  initialCustomerName={order.customerName}
                  initialCustomerEmail={order.customerEmail}
                  initialCustomerPhone={order.customerPhone || ""}
                  initialNotes={order.notes || ""}
                  initialStatus={order.status}
                />
              </div>
            </div>

            <FactoryActions orderId={order.id} currentStatus={order.status} />
          </div>

          <div className="space-y-8">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <h2 className="text-2xl font-semibold">Production Lines</h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Track each part / frame combination through the factory.
                  </p>
                </div>

                <span className="inline-flex rounded-full border px-3 py-1 text-xs font-semibold bg-slate-100 text-slate-700 border-slate-200">
                  {typedProductionLines.length} line
                  {typedProductionLines.length === 1 ? "" : "s"}
                </span>
              </div>

              {typedProductionLines.length === 0 ? (
                <div className="mt-6 rounded-xl border border-dashed bg-slate-50 p-6 text-sm text-slate-500">
                  No production lines yet. They will appear once the order is sent
                  to factory and includes valid Part # / Frame Needed combinations.
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
              <div className="mb-4 flex items-end justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-semibold">
                    Completed Furniture Photos
                  </h2>
                  <p className="mt-2 text-sm text-slate-500">
                    Quick visual inventory of finished production lines.
                  </p>
                </div>
              </div>

              {typedProductionLines.filter((line) => line.completedPhotoUrl).length ===
              0 ? (
                <p className="text-sm text-slate-500">
                  No completed furniture photos uploaded yet.
                </p>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {typedProductionLines
                    .filter((line) => line.completedPhotoUrl)
                    .map((line) => (
                      <div
                        key={`${line.id}-photo`}
                        className="rounded-2xl border bg-slate-50 p-4"
                      >
                        <img
                          src={line.completedPhotoUrl || ""}
                          alt={`${line.partNumber} completed`}
                          className="h-52 w-full rounded-xl object-cover"
                        />
                        <p className="mt-3 font-semibold">
                          {line.partNumber} / {line.frameNeeded}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Qty {line.quantity}
                        </p>
                      </div>
                    ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Order Items</h2>

              <div className="mt-4 space-y-6">
                {typedItems.map((item: OrderItemWithSelections) => (
                  <div
                    key={item.id}
                    className="rounded-2xl border bg-slate-50 p-5"
                  >
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold">
                        {item.productNameSnapshot}
                      </h3>
                      <p className="mt-1 text-slate-600">
                        Base Price:{" "}
                        {formatCurrency(Number(item.basePriceSnapshot))}
                      </p>
                      <p className="mt-1 text-slate-600">
                        Line Total: {formatCurrency(Number(item.lineTotal))}
                      </p>
                    </div>

                    <div className="space-y-3">
                      {item.selections.map((selection: OrderSelectionItem) => (
                        <div
                          key={selection.id}
                          className="flex items-center justify-between rounded-lg border bg-white px-4 py-3"
                        >
                          <div>
                            <p className="font-medium">
                              {selection.optionGroupNameSnapshot}
                            </p>
                            <p className="text-sm text-slate-500">
                              {selection.optionChoiceNameSnapshot}
                            </p>
                          </div>

                          <div className="font-medium">
                            {Number(selection.priceDeltaSnapshot) === 0
                              ? "Included"
                              : formatCurrency(
                                  Number(selection.priceDeltaSnapshot)
                                )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Revision History</h2>

              <div className="mt-4 space-y-4">
                {typedRevisions.length === 0 ? (
                  <p className="text-slate-500">No revisions yet.</p>
                ) : (
                  typedRevisions.map((revision: OrderRevisionItem) => (
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

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Email Logs</h2>

              <div className="mt-4 space-y-4">
                {typedEmailLogs.length === 0 ? (
                  <p className="text-slate-500">No email logs yet.</p>
                ) : (
                  typedEmailLogs.map((log: EmailLogItem) => (
                    <div
                      key={log.id}
                      className="rounded-xl border bg-slate-50 p-4"
                    >
                      <p className="font-medium">
                        {log.eventType} — {log.status}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        To: {log.recipient}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Subject: {log.subject || "No subject"}
                      </p>
                      {log.errorMessage ? (
                        <p className="mt-1 text-sm text-red-600">
                          Error: {log.errorMessage}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-500">
                        {formatCentralDateTime(log.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Google Sheets Logs</h2>

              <div className="mt-4 space-y-4">
                {typedSheetSyncLogs.length === 0 ? (
                  <p className="text-slate-500">No sheets sync logs yet.</p>
                ) : (
                  typedSheetSyncLogs.map((log: SheetSyncLogItem) => (
                    <div
                      key={log.id}
                      className="rounded-xl border bg-slate-50 p-4"
                    >
                      <p className="font-medium">{log.status}</p>
                      <p className="mt-1 text-sm text-slate-500">
                        Spreadsheet: {log.spreadsheetId || "Unknown"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Worksheet: {log.worksheetName || "Unknown"}
                      </p>
                      <p className="mt-1 text-sm text-slate-500">
                        Row Sync Marker: {log.spreadsheetRowId || "Unknown"}
                      </p>
                      {log.errorMessage ? (
                        <p className="mt-1 text-sm text-red-600">
                          Error: {log.errorMessage}
                        </p>
                      ) : null}
                      <p className="mt-1 text-sm text-slate-500">
                        {formatCentralDateTime(log.createdAt)}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}