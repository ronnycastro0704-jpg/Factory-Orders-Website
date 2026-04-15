"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  leather: {
    id: string;
    name: string;
    grade: string;
    imageUrl: string | null;
    active?: boolean;
  };
};

const gradeOptions = [
  "Grade A",
  "Grade B",
  "Grade EMB",
  "Grade HOH",
  "Grade Axis",
  "Grade Buffalo",
  "COM",
];

export default function LeatherRowActions({ leather }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(leather.name);
  const [grade, setGrade] = useState(leather.grade);
  const [imageUrl, setImageUrl] = useState(leather.imageUrl || "");
  const [active, setActive] = useState(leather.active ?? true);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/leathers/${leather.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          grade,
          imageUrl,
          active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update leather.");
        setLoading(false);
        return;
      }

      setEditing(false);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to update leather.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete leather "${leather.name}"? This cannot be undone.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/leathers/${leather.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete leather.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to delete leather.");
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
          Edit
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Leather Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Grade</label>
        <select
          className="w-full rounded-lg border px-3 py-2"
          value={grade}
          onChange={(e) => setGrade(e.target.value)}
        >
          {gradeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Image URL</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
      </div>

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
          {loading ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setName(leather.name);
            setGrade(leather.grade);
            setImageUrl(leather.imageUrl || "");
            setActive(leather.active ?? true);
          }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}