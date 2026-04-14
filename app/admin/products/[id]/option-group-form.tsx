"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  productId: string;
};

export default function CreateOptionGroupForm({ productId }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [required, setRequired] = useState(false);
  const [type, setType] = useState("SINGLE_SELECT");
  const [displayOrder, setDisplayOrder] = useState("0");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch(`/api/admin/products/${productId}/option-groups`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          required,
          type,
          displayOrder: Number(displayOrder),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess("Option group created.");
      setName("");
      setRequired(false);
      setType("SINGLE_SELECT");
      setDisplayOrder("0");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to create option group.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Group Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Inside Back"
          required
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

      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-medium text-green-600">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Option Group"}
      </button>
    </form>
  );
}