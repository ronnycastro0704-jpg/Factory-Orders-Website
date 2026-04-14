"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  orderId: string;
  currentStatus: string;
};

export default function FactoryActions({ orderId, currentStatus }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function runAction(action: "sent_to_factory" | "completed") {
    setLoading(action);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/orders/${orderId}/factory`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ action }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update order.");
        setLoading("");
        return;
      }

      setSuccess(
        action === "sent_to_factory"
          ? "Order marked as sent to factory."
          : "Order marked as completed."
      );
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to update order.");
    } finally {
      setLoading("");
    }
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <h2 className="text-2xl font-semibold">Factory Workflow</h2>
      <p className="mt-2 text-sm text-slate-500">
        Current status: {currentStatus}
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => runAction("sent_to_factory")}
          disabled={loading !== "" || currentStatus === "SENT_TO_FACTORY" || currentStatus === "COMPLETED"}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading === "sent_to_factory" ? "Sending..." : "Send to Factory"}
        </button>

        <button
          type="button"
          onClick={() => runAction("completed")}
          disabled={loading !== "" || currentStatus === "COMPLETED"}
          className="rounded-lg border px-4 py-2 hover:bg-slate-100 disabled:opacity-50"
        >
          {loading === "completed" ? "Saving..." : "Mark Completed"}
        </button>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-green-600">{success}</p> : null}
    </div>
  );
}