"use client";

export default function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="button-primary print:hidden"
    >
      Print Invoice
    </button>
  );
}