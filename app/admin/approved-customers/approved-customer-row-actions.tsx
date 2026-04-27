"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ApprovedCustomer = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

export default function ApprovedCustomerRowActions({
  customer,
}: {
  customer: ApprovedCustomer;
}) {
  const router = useRouter();

  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [active, setActive] = useState(customer.active);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/approved-customers/${customer.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          email,
          active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update approved customer.");
      }

      setEditing(false);
      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update approved customer."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete approved customer ${customer.email}?`
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/approved-customers/${customer.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete approved customer.");
      }

      router.refresh();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to delete approved customer."
      );
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 text-left">
        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <input
          className="w-full rounded-lg border px-3 py-2 text-sm"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          type="email"
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) => setActive(event.target.checked)}
          />
          Active
        </label>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setName(customer.name);
              setEmail(customer.email);
              setActive(customer.active);
              setError("");
            }}
            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => setEditing(true)}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Edit
        </button>

        <button
          type="button"
          disabled={saving}
          onClick={handleDelete}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
        >
          Delete
        </button>
      </div>
    </div>
  );
}