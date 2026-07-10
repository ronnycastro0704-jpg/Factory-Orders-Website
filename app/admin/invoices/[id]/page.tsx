import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";
import { formatCurrency } from "../../../../lib/utils";
import EmailInvoiceButton from "./email-invoice-button";
import { formatCentralDate } from "../../../../lib/central-time";
import PrintButton from "./print-button";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type InvoiceItemSummary = {
  productName: string;
  quantity: number;
  basePrice: number;
  lineTotal: number;
  selections: {
    groupName: string;
    choiceLabel: string;
    leatherName: string | null;
    leatherGrade: string | null;
    amount: number;
  }[];
};

function parseItemSummary(value: unknown): InvoiceItemSummary[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const rawItem = item as Partial<InvoiceItemSummary>;

      return {
        productName: String(rawItem.productName || "Item"),
        quantity: Number(rawItem.quantity || 1),
        basePrice: Number(rawItem.basePrice || 0),
        lineTotal: Number(rawItem.lineTotal || 0),
        selections: Array.isArray(rawItem.selections)
          ? rawItem.selections.map((selection) => ({
              groupName: String(selection.groupName || ""),
              choiceLabel: String(selection.choiceLabel || ""),
              leatherName: selection.leatherName
                ? String(selection.leatherName)
                : null,
              leatherGrade: selection.leatherGrade
                ? String(selection.leatherGrade)
                : null,
              amount: Number(selection.amount || 0),
            }))
          : [],
      };
    })
    .filter(Boolean) as InvoiceItemSummary[];
}

function getInvoiceStatusClasses(status: string) {
  switch (status) {
    case "PAID":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "ISSUED":
      return "border-blue-200 bg-blue-50 text-blue-700";
    case "VOID":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-slate-200 bg-slate-100 text-slate-700";
  }
}

export default async function AdminInvoiceDetailPage({ params }: PageProps) {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/");
  }

  const { id } = await params;

  const invoice = await prisma.invoice.findUnique({
    where: {
      id,
    },
    include: {
      orders: {
        orderBy: {
          createdAt: "asc",
        },
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              poNumber: true,
              status: true,
              overallProductionStatus: true,
            },
          },
        },
      },
    },
  });

  if (!invoice) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 text-slate-900 print:bg-white sm:p-6 lg:p-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div className="flex flex-wrap gap-3">
            <Link href="/admin/invoices" className="button-secondary">
              ← Invoices
            </Link>
            <Link href="/admin/orders" className="button-secondary">
              Orders
            </Link>
          </div>

          <div className="flex flex-wrap items-center gap-3">
  <a
    href={`/api/admin/invoices/${invoice.id}/pdf`}
    className="button-secondary"
  >
    Download PDF
  </a>
  <EmailInvoiceButton invoiceId={invoice.id} />
  <PrintButton />
</div>
        </div>

        <section className="rounded-2xl border bg-white p-6 shadow-sm print:border-0 print:shadow-none">
          <div className="flex flex-col gap-6 border-b pb-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="mb-8 flex flex-col gap-6 border-b pb-6 sm:flex-row sm:items-start sm:justify-between">
  <div>
    <h2 className="text-xl font-bold text-slate-900">Western Collection</h2>
    <div className="mt-2 space-y-1 text-sm text-slate-600">
      <p>51 County Road 4325</p>
      <p>Enlote, TX 75331 US</p>
      <p>+8176006569</p>
      <p>ronnycastro0704@gmail.com</p>
    </div>
  </div>

  <div className="sm:text-right">
    <p className="text-sm uppercase tracking-[0.16em] text-slate-500">
      Invoice
    </p>
    <h1 className="mt-2 text-4xl font-bold">{invoice.invoiceNumber}</h1>
  </div>
</div>
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">
                Invoice
              </p>
              <h1 className="mt-2 text-4xl font-bold">
                {invoice.invoiceNumber}
              </h1>

              <span
                className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getInvoiceStatusClasses(
                  invoice.status
                )}`}
              >
                {invoice.status}
              </span>
            </div>

            <div className="text-sm text-slate-600 lg:text-right">
              <p>
                <span className="font-semibold text-slate-900">Issued:</span>{" "}
                {formatCentralDate(invoice.issuedAt)}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Due Date:</span>{" "}
                {formatCentralDate(invoice.dueAt)}
              </p>
              <p className="mt-1">
                <span className="font-semibold text-slate-900">Terms:</span>{" "}
                {invoice.terms}
              </p>
            </div>
          </div>

          <div className="grid gap-6 border-b py-6 md:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Bill To
              </p>
              <p className="mt-2 text-lg font-bold">{invoice.customerName}</p>
              <p className="text-sm text-slate-600">{invoice.customerEmail}</p>
            </div>

            <div className="md:text-right">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Invoice Total
              </p>
              <p className="mt-2 text-4xl font-bold">
                {formatCurrency(Number(invoice.total))}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Due upon receipt
              </p>
            </div>
          </div>

          <div className="py-6">
            <h2 className="text-2xl font-bold">Orders</h2>

            <div className="mt-4 space-y-6">
              {invoice.orders.map((invoiceOrder) => {
                const itemSummary = parseItemSummary(invoiceOrder.itemSummary);

                return (
                  <div
                    key={invoiceOrder.id}
                    className="rounded-2xl border bg-white p-5"
                  >
                    <div className="flex flex-col gap-4 border-b pb-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <p className="text-lg font-bold">
                          {invoiceOrder.orderNumber}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          PO # {invoiceOrder.poNumber || "—"}
                        </p>
                        <p className="mt-1 text-sm text-slate-600">
                          {invoiceOrder.productSummary}
                        </p>
                      </div>

                      <div className="lg:text-right">
                        <p className="text-xl font-bold">
                          {formatCurrency(Number(invoiceOrder.orderTotal))}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Qty {invoiceOrder.quantity}
                        </p>
                      </div>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="w-full min-w-[700px] text-left text-sm">
                        <thead>
                          <tr className="border-b text-xs uppercase tracking-[0.12em] text-slate-500">
                            <th className="py-3 pr-4">Item</th>
                            <th className="py-3 pr-4">Selections</th>
                            <th className="py-3 pr-4 text-right">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {itemSummary.map((item, itemIndex) => (
                            <tr
                              key={`${invoiceOrder.id}-${itemIndex}`}
                              className="border-b last:border-0"
                            >
                              <td className="py-4 pr-4 align-top">
                                <p className="font-semibold">
                                  {item.productName}
                                </p>
                                <p className="mt-1 text-xs text-slate-500">
                                  Qty {item.quantity} • Base{" "}
                                  {formatCurrency(item.basePrice)}
                                </p>
                              </td>

                              <td className="py-4 pr-4 align-top">
                                {item.selections.length === 0 ? (
                                  <p className="text-slate-500">—</p>
                                ) : (
                                  <ul className="space-y-1">
                                    {item.selections.map(
                                      (selection, selectionIndex) => (
                                        <li
                                          key={`${invoiceOrder.id}-${itemIndex}-${selectionIndex}`}
                                          className="text-xs text-slate-600"
                                        >
                                          <span className="font-semibold">
                                            {selection.groupName}:
                                          </span>{" "}
                                          {selection.choiceLabel}
                                          {selection.leatherName ? (
                                            <>
                                              {" "}
                                              • Leather: {selection.leatherName}
                                              {selection.leatherGrade
                                                ? ` (${selection.leatherGrade})`
                                                : ""}
                                            </>
                                          ) : null}
                                        </li>
                                      )
                                    )}
                                  </ul>
                                )}
                              </td>

                              <td className="py-4 pr-4 text-right align-top font-semibold">
                                {formatCurrency(item.lineTotal)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {invoice.notes ? (
            <div className="border-t py-6">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                Notes
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                {invoice.notes}
              </p>
            </div>
          ) : null}

          <div className="border-t pt-6">
            <div className="ml-auto max-w-sm space-y-3">
<div className="flex justify-between gap-4 text-sm">
  <span className="text-slate-600">Subtotal</span>
  <span className="font-semibold">
    {formatCurrency(Number(invoice.subtotal))}
  </span>
</div>

{Number(invoice.surchargeAmount || 0) > 0 ? (
  <div className="flex justify-between gap-4 text-sm">
    <span className="text-slate-600">
      {invoice.surchargeLabel || "Surcharge"}
    </span>
    <span className="font-semibold">
      {formatCurrency(Number(invoice.surchargeAmount))}
    </span>
  </div>
) : null}

<div className="flex justify-between gap-4 border-t pt-3 text-xl font-bold">
  <span>Total Due</span>
  <span>{formatCurrency(Number(invoice.total))}</span>
</div>

              <p className="text-right text-sm text-slate-500">
                Due upon receipt
              </p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}