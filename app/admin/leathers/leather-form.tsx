"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

const gradeOptions = [
  "Grade A",
  "Grade B",
  "Grade EMB",
  "Grade HOH",
  "Grade Axis",
  "Grade Buffalo",
  "COM",
];

export default function CreateLeatherForm() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [grade, setGrade] = useState("Grade A");
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

      const response = await fetch("/api/admin/leathers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          grade,
          imageUrl: finalImageUrl,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess("Leather created successfully.");
      setName("");
      setGrade("Grade A");
      setImageUrl("");
      setImageFile(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to create leather.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Leather Name</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Mustang"
          required
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
        <label className="mb-1 block text-sm font-medium">Upload Image</label>
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

      {uploading ? <p className="text-sm text-slate-500">Uploading image...</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-medium text-green-600">{success}</p> : null}

      <button
        type="submit"
        disabled={loading || uploading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create Leather"}
      </button>
    </form>
  );
}