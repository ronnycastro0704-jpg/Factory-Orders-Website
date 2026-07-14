"use client";

import { useState } from "react";

type Props = {
  invoiceId: string;
};

export default function PrintButton({ invoiceId }: Props) {
  const [printing, setPrinting] = useState(false);

  async function handlePrintPdf() {
    setPrinting(true);

    try {
      const response = await fetch(`/api/admin/invoices/${invoiceId}/pdf`);

      if (!response.ok) {
        throw new Error("Failed to load invoice PDF.");
      }

      const pdfBlob = await response.blob();
      const pdfUrl = URL.createObjectURL(pdfBlob);

      const iframe = document.createElement("iframe");
      iframe.style.position = "fixed";
      iframe.style.right = "0";
      iframe.style.bottom = "0";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "0";
      iframe.src = pdfUrl;

      iframe.onload = () => {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();

        setTimeout(() => {
          URL.revokeObjectURL(pdfUrl);
          iframe.remove();
        }, 60_000);
      };

      document.body.appendChild(iframe);
    } catch (error) {
      console.error(error);
      window.alert("Failed to print invoice PDF.");
    } finally {
      setPrinting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handlePrintPdf}
      disabled={printing}
      className="button-secondary disabled:opacity-50"
    >
      {printing ? "Preparing PDF..." : "Print PDF"}
    </button>
  );
}