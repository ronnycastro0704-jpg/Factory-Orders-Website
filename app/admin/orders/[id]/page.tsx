import { prisma } from "../../../../lib/prisma";
import { formatCurrency } from "../../../../lib/utils";
import { notFound } from "next/navigation";
import EditOrderForm from "./edit-order-form";
import FactoryActions from "./factory-actions";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

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
    },
  });

  if (!order) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Order</p>
          <h1 className="mt-2 text-3xl font-bold">{order.orderNumber}</h1>
          <p className="mt-2 text-slate-600">
            {order.customerName} • {order.customerEmail}
          </p>
          {order.customerPhone ? (
            <p className="mt-1 text-slate-600">{order.customerPhone}</p>
          ) : null}
          {order.notes ? (
            <p className="mt-4 text-slate-600">Notes: {order.notes}</p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-500">
            <span>Status: {order.status}</span>
            <span>Created: {new Date(order.createdAt).toLocaleString()}</span>
            <span>Total: {formatCurrency(Number(order.total))}</span>
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
              <h2 className="text-2xl font-semibold">Order Items</h2>

              <div className="mt-4 space-y-6">
                {order.items.map((item) => (
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
                      {item.selections.map((selection) => (
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
                {order.revisions.length === 0 ? (
                  <p className="text-slate-500">No revisions yet.</p>
                ) : (
                  order.revisions.map((revision) => (
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
                        {new Date(revision.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Email Logs</h2>

              <div className="mt-4 space-y-4">
                {order.emailLogs.length === 0 ? (
                  <p className="text-slate-500">No email logs yet.</p>
                ) : (
                  order.emailLogs.map((log) => (
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
                        {new Date(log.createdAt).toLocaleString()}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Google Sheets Logs</h2>

              <div className="mt-4 space-y-4">
                {order.sheetSyncLogs.length === 0 ? (
                  <p className="text-slate-500">No sheets sync logs yet.</p>
                ) : (
                  order.sheetSyncLogs.map((log) => (
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
                        {new Date(log.createdAt).toLocaleString()}
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