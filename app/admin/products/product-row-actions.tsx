"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Props = {
  product: {
    id: string;
    name: string;
    description: string | null;
    sku: string | null;
    imageUrl: string | null;
    basePrice: number;
    active: boolean;
  };
};

export default function ProductRowActions({ product }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(product.name);
  const [description, setDescription] = useState(product.description || "");
  const [sku, setSku] = useState(product.sku || "");
  const [imageUrl, setImageUrl] = useState(product.imageUrl || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [basePrice, setBasePrice] = useState(String(product.basePrice));
  const [active, setActive] = useState(product.active);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  async function uploadImageIfNeeded() {
    if (!imageFile) return imageUrl;

    setUploading(true);

    const formData = new FormData();
    formData.append("file", imageFile);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setUploading(false);

    if (!response.ok) {
      throw new Error(data.error || "Failed to upload image.");
    }

    return data.url as string;
  }

  async function handleSave() {
    setLoading(true);
    setError("");

    try {
      const finalImageUrl = await uploadImageIfNeeded();

      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          sku,
          imageUrl: finalImageUrl,
          basePrice: Number(basePrice),
          active,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update product.");
        setLoading(false);
        return;
      }

      setEditing(false);
      setImageFile(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to update product.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete product "${product.name}"? This will also remove its option groups and choices if there are no orders yet.`
    );

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/admin/products/${product.id}`, {
        method: "DELETE",
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete product.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to delete product.");
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
          Edit Product
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete Product
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Product Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">SKU</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={sku}
          onChange={(e) => setSku(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Upload Product Image</label>
        <input
          type="file"
          accept="image/*"
          className="w-full rounded-lg border px-3 py-2"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Image URL</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
        />
        <p className="mt-1 text-xs text-slate-500">
          Clear this field and save if you want to remove the image.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Base Price</label>
        <input
          type="number"
          step="0.01"
          min="0"
          className="w-full rounded-lg border px-3 py-2"
          value={basePrice}
          onChange={(e) => setBasePrice(e.target.value)}
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

      {uploading ? (
        <p className="text-sm text-slate-500">Uploading image...</p>
      ) : null}

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || uploading}
          className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Product"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setName(product.name);
            setDescription(product.description || "");
            setSku(product.sku || "");
            setImageUrl(product.imageUrl || "");
            setImageFile(null);
            setBasePrice(String(product.basePrice));
            setActive(product.active);
          }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}