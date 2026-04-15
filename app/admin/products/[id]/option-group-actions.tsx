"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  productId: string;
  group: {
    id: string;
    name: string;
    type: string;
    required: boolean;
    displayOrder: number;
    active: boolean;
  };
};

export default function OptionGroupActions({ productId, group }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(group.name);
  const [type, setType] = useState(group.type);
  const [required, setRequired] = useState(group.required);
  const [displayOrder, setDisplayOrder] = useState(String(group.displayOrder));
  const [active, setActive] = useState(group.active);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/option-groups/${group.id}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name,
            type,
            required,
            displayOrder: Number(displayOrder),
            active,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update option group.");
        setLoading(false);
        return;
      }

      setEditing(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to update option group.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete option group "${group.name}"? This will also remove its choices.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/products/${productId}/option-groups/${group.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete option group.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to delete option group.");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Edit Group
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete Group
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Group Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Type</label>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="SINGLE_SELECT">Single Select</option>
          <option value="MULTI_SELECT">Multi Select</option>
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Display Order</label>
        <input
          type="number"
          className="w-full rounded-lg border px-3 py-2"
          value={displayOrder}
          onChange={(e) => setDisplayOrder(e.target.value)}
        />
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
        />
        Required
      </label>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Group"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setName(group.name);
            setType(group.type);
            setRequired(group.required);
            setDisplayOrder(String(group.displayOrder));
            setActive(group.active);
          }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}