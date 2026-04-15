"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

export default function CreateProductForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sku, setSku] = useState("");
  const [basePrice, setBasePrice] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const finalImageUrl = await uploadImageIfNeeded();

      const response = await fetch("/api/admin/products", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          description,
          sku,
          imageUrl: finalImageUrl,
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
      setImageUrl("");
      setImageFile(null);
      router.refresh();
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to create product.");
    } finally {
      setLoading(false);
      setUploading(false);
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
        <label className="mb-1 block text-sm font-medium">Upload Product Image</label>
        <input
          type="file"
          accept="image/*"
          className="w-full rounded-lg border px-3 py-2"
          onChange={(e) => setImageFile(e.target.files?.[0] || null)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Or Paste Image URL</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          placeholder="https://..."
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

      {uploading ? (
        <p className="text-sm text-slate-500">Uploading image...</p>
      ) : null}

      {error ? (
        <p className="text-sm font-medium text-red-600">{error}</p>
      ) : null}

      {success ? (
        <p className="text-sm font-medium text-green-600">{success}</p>
      ) : null}

      <button
        type="submit"
        disabled={loading || uploading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Product"}
      </button>
    </form>
  );
}