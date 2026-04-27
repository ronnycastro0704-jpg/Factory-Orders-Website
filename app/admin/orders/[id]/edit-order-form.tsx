"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  orderId: string;
  initialCustomerName: string;
  initialCustomerEmail: string;
  initialCustomerPhone: string;
  initialNotes: string;
  initialStatus: string;
};

const statusOptions = [
  "DRAFT",
  "SUBMITTED",
  "CHANGED",
  "SENT_TO_FACTORY",
  "COMPLETED",
  "PAID",
  "CANCELLED",
];

export default function EditOrderForm({
  orderId,
  initialCustomerName,
  initialCustomerEmail,
  initialCustomerPhone,
  initialNotes,
  initialStatus,
}: Props) {
  const router = useRouter();

  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [notes, setNotes] = useState(initialNotes);
  const [status, setStatus] = useState(initialStatus);
  const [changeReason, setChangeReason] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          notes,
          status,
          changeReason,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update order.");
        setLoading(false);
        return;
      }

      setSuccess("Order updated successfully.");
      setChangeReason("");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to update order.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Customer Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={customerName}
          onChange={(e) => setCustomerName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Customer Email</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={customerEmail}
          onChange={(e) => setCustomerEmail(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Customer Phone</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={customerPhone}
          onChange={(e) => setCustomerPhone(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Status</label>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          {statusOptions.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Notes</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          rows={4}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Change Reason
        </label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={changeReason}
          onChange={(e) => setChangeReason(e.target.value)}
          placeholder="Example: marked invoice as paid"
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      {success ? (
        <p className="text-sm font-medium text-green-600">{success}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Saving..." : "Save Order Changes"}
      </button>
    </form>
  );
}
