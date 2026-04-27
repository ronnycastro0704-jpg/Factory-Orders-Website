"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function ApprovedCustomerForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/approved-customers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add approved customer.");
      }

      setName("");
      setEmail("");
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to add approved customer."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Customer name
        </label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Ian"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-slate-700">
          Customer email
        </label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="customer@example.com"
          type="email"
        />
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Adding..." : "Add"}
        </button>
      </div>

      {error ? (
        <p className="md:col-span-3 text-sm text-red-600">{error}</p>
      ) : null}
    </form>
  );
}