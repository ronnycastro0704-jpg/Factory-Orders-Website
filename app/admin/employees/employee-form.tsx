"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

const DEPARTMENTS = [
  "CUTTING",
  "SEWING",
  "UPHOLSTERY",
  "ASSEMBLY",
  "QC",
  "GENERAL",
];

export default function EmployeeForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [department, setDepartment] = useState("UPHOLSTERY");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setSaving(true);
    setError("");

    try {
      const response = await fetch("/api/admin/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          department,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to add employee.");
      }

      setName("");
      setDepartment("UPHOLSTERY");
      router.refresh();
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Failed to add employee."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-4 md:grid-cols-[1fr_240px_auto]"
    >
      <div>
        <label className="mb-1 block text-sm font-medium">
          Employee Name
        </label>
        <input
          className="w-full rounded-lg border bg-white px-3 py-2"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Employee name"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">
          Department
        </label>
        <select
          className="w-full rounded-lg border bg-white px-3 py-2"
          value={department}
          onChange={(event) => setDepartment(event.target.value)}
        >
          {DEPARTMENTS.map((item) => (
            <option key={item} value={item}>
              {item.replaceAll("_", " ")}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-end">
        <button
          type="submit"
          disabled={saving}
          className="button-primary disabled:opacity-50"
        >
          {saving ? "Adding..." : "Add Employee"}
        </button>
      </div>

      {error ? (
        <p className="md:col-span-3 text-sm text-red-600">{error}</p>
      ) : null}
    </form>
  );
}