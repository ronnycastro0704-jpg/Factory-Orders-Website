"use client";

import { useState } from "react";

type Props = {
  invoiceId: string;
};

export default function EmailInvoiceButton({ invoiceId }: Props) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function sendInvoice() {
    setLoading(true);
    setMessage("");
    setError("");

    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/email`, {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to email invoice.");
        return;
      }

      setMessage("Invoice emailed to customer.");
    } catch (sendError) {
      console.error(sendError);
      setError("Failed to email invoice.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="print:hidden">
      <button
        type="button"
        onClick={sendInvoice}
        disabled={loading}
        className="button-secondary"
      >
        {loading ? "Sending..." : "Email Invoice"}
      </button>

      {message ? (
        <p className="mt-2 text-sm font-medium text-green-600">{message}</p>
      ) : null}

      {error ? (
        <p className="mt-2 text-sm font-medium text-red-600">{error}</p>
      ) : null}
    </div>
  );
}