"use client";

import { FormEvent, useState } from "react";

type Props = {
  initialRetailMultiplier: number;
};

export default function RetailMultiplierForm({
  initialRetailMultiplier,
}: Props) {
  const [retailMultiplier, setRetailMultiplier] = useState(
    String(initialRetailMultiplier || 1)
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch("/api/my/retail-multiplier", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          retailMultiplier: Number(retailMultiplier || 1),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update retail multiplier.");
      }

      setRetailMultiplier(String(data.retailMultiplier || 1));
      setMessage("Retail multiplier updated.");
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update retail multiplier."
      );
    } finally {
      setSaving(false);
    }
  }

  const previewMultiplier = Number(retailMultiplier || 1);
  const previewWholesale = 100;
  const previewRetail =
    Number.isFinite(previewMultiplier) && previewMultiplier > 0
      ? previewWholesale * previewMultiplier
      : previewWholesale;

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-900">
          Retail Multiplier
        </h2>

        <p className="mt-2 text-sm text-slate-600">
          Use this to show retail pricing on the builder. Example: enter{" "}
          <span className="font-semibold">2</span> to show prices doubled.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Multiplier
        </label>
        <input
          type="number"
          step="0.01"
          min="1"
          max="10"
          className="w-full rounded-lg border px-3 py-2"
          value={retailMultiplier}
          onChange={(event) => setRetailMultiplier(event.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500">
          1 = wholesale display. 2 = double price. This does not change saved
          order totals.
        </p>
      </div>

      <div className="rounded-xl border bg-slate-50 p-4 text-sm">
        <p className="font-semibold text-slate-900">Preview</p>
        <p className="mt-2 text-slate-600">
          Wholesale $100.00 displays as{" "}
          <span className="font-bold text-slate-900">
            ${previewRetail.toFixed(2)}
          </span>
        </p>
      </div>

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

      <button
        type="submit"
        disabled={saving}
        className="button-primary disabled:opacity-50"
      >
        {saving ? "Saving..." : "Save Retail Multiplier"}
      </button>
    </form>
  );
}