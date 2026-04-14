"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function CreateProductForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          sku,
          basePrice: Number(basePrice),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess("Product created successfully.");
      setName("");
      setDescription("");
      setSku("");
      setBasePrice("");
      router.refresh();
    } catch (err) {
      console.error(err);
      setError("Failed to create product.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Product Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Custom Chair"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional description"
          rows={4}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">SKU</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
          placeholder="CHAIR-001"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Base Price</label>
        <input
          type="number"
          min="0"
          step="0.01"
          className="w-full rounded-lg border px-3 py-2"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
          placeholder="450.00"
          required
        />
      </div>

      {error ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      {success ? (
        <p className="text-sm font-medium text-green-600">{success}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Product"}
      </button>
    </form>
  );
}