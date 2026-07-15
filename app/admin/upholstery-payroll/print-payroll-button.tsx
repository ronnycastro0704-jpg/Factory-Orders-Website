"use client";

import { formatCurrency } from "../../../lib/utils";

type PayrollEntry = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  productName: string;
  partNumber: string;
  frameName: string;
  quantity: number;
  rate: number;
  total: number;
  checked: boolean;
};

type Props = {
  employeeName: string;
  weekStart: string;
  entries: PayrollEntry[];
};

export default function PrintPayrollButton({
  employeeName,
  weekStart,
  entries,
}: Props) {
  const checkedEntries = entries.filter((entry) => entry.checked);
  const totalPay = checkedEntries.reduce((sum, entry) => sum + entry.total, 0);

  function handlePrint() {
    const printWindow = window.open("", "_blank", "width=1000,height=800");

    if (!printWindow) {
      alert("Popup blocked. Please allow popups to print payroll.");
      return;
    }

    const rowsHtml = checkedEntries
      .map(
        (entry) => `
          <tr>
            <td>${entry.orderNumber}</td>
            <td>${entry.poNumber || "-"}</td>
            <td>${entry.customerName}</td>
            <td>${entry.productName}</td>
            <td>${entry.partNumber}</td>
            <td>${entry.frameName}</td>
            <td style="text-align:right;">${entry.quantity}</td>
            <td style="text-align:right;">${formatCurrency(entry.rate)}</td>
            <td style="text-align:right;font-weight:700;">${formatCurrency(entry.total)}</td>
          </tr>
        `
      )
      .join("");

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Upholstery Payroll</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              color: #111827;
              padding: 32px;
            }

            h1, h2, p {
              margin: 0;
            }

            .muted {
              color: #64748b;
              font-size: 13px;
            }

            .header {
              display: flex;
              justify-content: space-between;
              gap: 24px;
              border-bottom: 1px solid #e5e7eb;
              padding-bottom: 20px;
              margin-bottom: 24px;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              margin-top: 20px;
              font-size: 12px;
            }

            th {
              text-align: left;
              border-bottom: 2px solid #111827;
              padding: 8px 6px;
            }

            td {
              border-bottom: 1px solid #e5e7eb;
              padding: 8px 6px;
              vertical-align: top;
            }

            .total {
              margin-top: 24px;
              border-top: 2px solid #111827;
              padding-top: 16px;
              display: flex;
              justify-content: space-between;
              font-size: 24px;
              font-weight: 700;
            }

            @media print {
              button {
                display: none;
              }
            }
          </style>
        </head>

        <body>
          <button onclick="window.print()" style="margin-bottom:24px;padding:10px 14px;border:1px solid #111827;background:#111827;color:white;border-radius:8px;">
            Print Payroll
          </button>

          <div class="header">
            <div>
              <p class="muted">Upholstery Payroll</p>
              <h1>${employeeName || "Employee"}</h1>
              <p class="muted" style="margin-top:8px;">Week of ${weekStart || "-"}</p>
            </div>

            <div style="text-align:right;">
              <p class="muted">Checked payroll rows</p>
              <h2>${checkedEntries.length}</h2>
            </div>
          </div>

          <table>
            <thead>
              <tr>
                <th>Order</th>
                <th>PO #</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Part #</th>
                <th>Frame</th>
                <th style="text-align:right;">Qty</th>
                <th style="text-align:right;">Rate</th>
                <th style="text-align:right;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${
                rowsHtml ||
                `<tr><td colspan="9" style="text-align:center;padding:24px;">No checked payroll rows.</td></tr>`
              }
            </tbody>
          </table>

          <div class="total">
            <span>Total Pay</span>
            <span>${formatCurrency(totalPay)}</span>
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={checkedEntries.length === 0}
      className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
    >
      Print Payroll
    </button>
  );
}