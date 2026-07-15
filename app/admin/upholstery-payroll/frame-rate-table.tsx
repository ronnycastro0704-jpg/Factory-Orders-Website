"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatCurrency } from "../../../lib/utils";

type FrameRateRow = {
  productId: string;
  optionChoiceId: string;
  productName: string;
  frameName: string;
  frameImageUrl: string | null;
  rate: number;
};

type Props = {
  rows: FrameRateRow[];
};

export default function FrameRateTable({ rows }: Props) {
  const router = useRouter();

  const [rates, setRates] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};

    for (const row of rows) {
      initial[row.optionChoiceId] = String(row.rate || 0);
    }

    return initial;
  });

  const [savingId, setSavingId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function saveRate(row: FrameRateRow) {
    setSavingId(row.optionChoiceId);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/admin/upholstery-payroll/frame-rates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: row.productId,
          optionChoiceId: row.optionChoiceId,
          productName: row.productName,
          frameName: row.frameName,
          frameImageUrl: row.frameImageUrl,
          rate: Number(rates[row.optionChoiceId] || 0),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to save frame rate.");
      }

      setMessage(`Saved ${row.productName} - ${row.frameName}.`);
      router.refresh();
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to save frame rate."
      );
    } finally {
      setSavingId("");
    }
  }

  return (
    <div className="space-y-4">
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

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-white/70 p-8 text-center text-sm text-slate-500">
          No frame choices found. Make sure each product has a first option group
          with frame choices.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase tracking-[0.12em] text-slate-500">
                <th className="py-3 pr-4">Frame</th>
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Image</th>
                <th className="py-3 pr-4">Current Rate</th>
                <th className="py-3 pr-4">New Rate</th>
                <th className="py-3 pr-4 text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row) => (
                <tr
                  key={`${row.productId}-${row.optionChoiceId}`}
                  className="border-b last:border-0"
                >
                  <td className="py-4 pr-4 font-semibold">{row.frameName}</td>
                  <td className="py-4 pr-4">{row.productName}</td>
                  <td className="py-4 pr-4">
                    {row.frameImageUrl ? (
                      <img
                        src={row.frameImageUrl}
                        alt={row.frameName}
                        className="h-14 w-14 rounded-lg border bg-white object-contain"
                      />
                    ) : (
                      <span className="text-slate-400">No image</span>
                    )}
                  </td>
                  <td className="py-4 pr-4 font-semibold">
                    {formatCurrency(row.rate || 0)}
                  </td>
                  <td className="py-4 pr-4">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="w-32 rounded-lg border bg-white px-3 py-2"
                      value={rates[row.optionChoiceId] || "0"}
                      onChange={(event) =>
                        setRates((current) => ({
                          ...current,
                          [row.optionChoiceId]: event.target.value,
                        }))
                      }
                    />
                  </td>
                  <td className="py-4 pr-4 text-right">
                    <button
                      type="button"
                      disabled={savingId === row.optionChoiceId}
                      onClick={() => saveRate(row)}
                      className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
                    >
                      {savingId === row.optionChoiceId ? "Saving..." : "Save"}
                    </button>
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