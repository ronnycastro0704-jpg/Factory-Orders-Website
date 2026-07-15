"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "../../../lib/utils";
import PrintPayrollButton from "./print-payroll-button";

type Employee = {
  id: string;
  name: string;
};

type PayrollEntry = {
  id: string;
  orderNumber: string;
  poNumber: string | null;
  customerName: string;
  productName: string;
  partNumber: string;
  frameName: string;
  frameImageUrl: string | null;
  quantity: number;
  rate: number;
  total: number;
  checked: boolean;
};

type Props = {
  employees: Employee[];
  selectedEmployeeName: string;
  selectedWeekStart: string;
  entries: PayrollEntry[];
};

export default function PayrollWeekBoard({
  employees,
  selectedEmployeeName,
  selectedWeekStart,
  entries,
}: Props) {
  const router = useRouter();

  const [generating, setGenerating] = useState(false);
  const [savingEntryId, setSavingEntryId] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const checkedEntries = entries.filter((entry) => entry.checked);
  const checkedTotal = checkedEntries.reduce((sum, entry) => sum + entry.total, 0);

  async function generateWeek() {
    if (!selectedEmployeeName || !selectedWeekStart) {
      setError("Choose an employee and payroll week first.");
      return;
    }

    setGenerating(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        "/api/admin/upholstery-payroll/generate-week",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            employeeName: selectedEmployeeName,
            weekStart: selectedWeekStart,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate payroll week.");
      }

      setMessage(
        `Generated payroll: ${data.createdCount} new, ${data.updatedCount} updated, ${data.skippedCount} skipped without frame rates.`
      );

      router.refresh();
    } catch (generateError) {
      setError(
        generateError instanceof Error
          ? generateError.message
          : "Failed to generate payroll week."
      );
    } finally {
      setGenerating(false);
    }
  }

  async function toggleEntry(entry: PayrollEntry) {
    setSavingEntryId(entry.id);
    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `/api/admin/upholstery-payroll/entries/${entry.id}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            checked: !entry.checked,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update payroll row.");
      }

      router.refresh();
    } catch (toggleError) {
      setError(
        toggleError instanceof Error
          ? toggleError.message
          : "Failed to update payroll row."
      );
    } finally {
      setSavingEntryId("");
    }
  }

  return (
    <div className="space-y-5">
      <form
        method="GET"
        className="grid gap-4 lg:grid-cols-[1fr_220px_auto_auto]"
      >
        <div>
          <label className="mb-1 block text-sm font-medium">
            Upholstery Employee
          </label>
          <select
            name="employee"
            defaultValue={selectedEmployeeName}
            className="w-full rounded-lg border bg-white px-3 py-2"
          >
            <option value="">Choose employee</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.name}>
                {employee.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Payroll Friday
          </label>
          <input
            type="date"
            name="weekStart"
            defaultValue={selectedWeekStart}
            className="w-full rounded-lg border bg-white px-3 py-2"
          />
        </div>

        <div className="flex items-end">
          <button type="submit" className="button-secondary">
            Load Payroll Week
          </button>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={generateWeek}
            disabled={generating || !selectedEmployeeName || !selectedWeekStart}
            className="button-primary disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? "Generating..." : "Generate Unchecked Rows"}
          </button>
        </div>
      </form>

      {message ? (
        <p className="rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {message}
        </p>
      ) : null}

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-slate-50 p-4">
        <div>
          <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
            Checked Payroll Total
          </p>
          <p className="mt-1 text-3xl font-bold">
            {formatCurrency(checkedTotal)}
          </p>
        </div>

        <PrintPayrollButton
          employeeName={selectedEmployeeName}
          weekStart={selectedWeekStart}
          entries={entries}
        />
      </div>

      {!selectedEmployeeName || !selectedWeekStart ? (
        <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm text-slate-500">
          Choose an employee and week to view payroll rows.
        </div>
      ) : entries.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm text-slate-500">
          No payroll rows for this payroll week yet. Click Generate Unpaid Rows to pull completed upholstered work that has not been checked/paid yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-3 pr-4">Pay</th>
                <th className="py-3 pr-4">Order</th>
                <th className="py-3 pr-4">PO #</th>
                <th className="py-3 pr-4">Customer</th>
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Frame</th>
                <th className="py-3 pr-4">Image</th>
                <th className="py-3 pr-4 text-right">Qty</th>
                <th className="py-3 pr-4 text-right">Rate</th>
                <th className="py-3 pr-4 text-right">Total</th>
              </tr>
            </thead>

            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="border-b last:border-0">
                  <td className="py-4 pr-4">
                    <input
                      type="checkbox"
                      checked={entry.checked}
                      disabled={savingEntryId === entry.id}
                      onChange={() => toggleEntry(entry)}
                      className="h-5 w-5"
                    />
                  </td>

                  <td className="py-4 pr-4 font-semibold">
                    {entry.orderNumber}
                  </td>

                  <td className="py-4 pr-4">{entry.poNumber || "—"}</td>
                  <td className="py-4 pr-4">{entry.customerName}</td>
                  <td className="py-4 pr-4">{entry.productName}</td>

                  <td className="py-4 pr-4">
                    <div className="font-semibold">{entry.frameName}</div>
                    <div className="text-xs text-slate-500">
                      Part # {entry.partNumber}
                    </div>
                  </td>

                  <td className="py-4 pr-4">
                    {entry.frameImageUrl ? (
                      <img
                        src={entry.frameImageUrl}
                        alt={entry.frameName}
                        className="h-14 w-14 rounded-lg border bg-white object-contain"
                      />
                    ) : (
                      <span className="text-slate-400">No image</span>
                    )}
                  </td>

                  <td className="py-4 pr-4 text-right">{entry.quantity}</td>
                  <td className="py-4 pr-4 text-right">
                    {formatCurrency(entry.rate)}
                  </td>
                  <td className="py-4 pr-4 text-right font-bold">
                    {formatCurrency(entry.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}