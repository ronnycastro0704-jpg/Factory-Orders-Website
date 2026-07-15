"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const DEPARTMENTS = [
  "CUTTING",
  "SEWING",
  "UPHOLSTERY",
  "ASSEMBLY",
  "QC",
  "GENERAL",
];

type Employee = {
  id: string;
  name: string;
  department: string;
  active: boolean;
};

export default function EmployeeRowActions({
  employee,
}: {
  employee: Employee;
}) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(employee.name);
  const [department, setDepartment] = useState(employee.department);
  const [active, setActive] = useState(employee.active);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          department,
          active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update employee.");
      }

      setEditing(false);
      router.refresh();
    } catch (updateError) {
      setError(
        updateError instanceof Error
          ? updateError.message
          : "Failed to update employee."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete employee ${employee.name}?`);

    if (!confirmed) return;

    setSaving(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/employees/${employee.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to delete employee.");
      }

      router.refresh();
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Failed to delete employee."
      );
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-2 text-left">
        <input
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />

        <select
          className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          {DEPARTMENTS.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>

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
              setName(employee.name);
              setDepartment(employee.department);
              setActive(employee.active);
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