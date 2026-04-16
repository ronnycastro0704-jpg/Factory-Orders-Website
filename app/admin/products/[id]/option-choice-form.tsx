"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";

type Props = {
  groupId: string;
};

export default function CreateOptionChoiceForm({ groupId }: Props) {
  const router = useRouter();

  const [label, setLabel] = useState("");
  const [value, setValue] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [priceDelta, setPriceDelta] = useState("0");
  const [displayOrder, setDisplayOrder] = useState("0");

  const [usesLeatherGrades, setUsesLeatherGrades] = useState(false);
  const [appliesLeatherSurcharge, setAppliesLeatherSurcharge] = useState(true);
  const [allowsLaseredBrand, setAllowsLaseredBrand] = useState(false);

  const [gradeAUpcharge, setGradeAUpcharge] = useState("");
  const [gradeBUpcharge, setGradeBUpcharge] = useState("");
  const [gradeEMBUpcharge, setGradeEMBUpcharge] = useState("");
  const [gradeHOHUpcharge, setGradeHOHUpcharge] = useState("");
  const [gradeAxisUpcharge, setGradeAxisUpcharge] = useState("");
  const [gradeBuffaloUpcharge, setGradeBuffaloUpcharge] = useState("");
  const [comUpcharge, setComUpcharge] = useState("");

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

      const response = await fetch(`/api/admin/option-groups/${groupId}/choices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          label,
          value,
          description,
          imageUrl: finalImageUrl,
          priceDelta: Number(priceDelta),
          displayOrder: Number(displayOrder),
          usesLeatherGrades,
          appliesLeatherSurcharge,
          allowsLaseredBrand,
          gradeAUpcharge,
          gradeBUpcharge,
          gradeEMBUpcharge,
          gradeHOHUpcharge,
          gradeAxisUpcharge,
          gradeBuffaloUpcharge,
          comUpcharge,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Something went wrong.");
        setLoading(false);
        return;
      }

      setSuccess("Choice created.");
      setLabel("");
      setValue("");
      setDescription("");
      setImageUrl("");
      setImageFile(null);
      setPriceDelta("0");
      setDisplayOrder("0");
      setUsesLeatherGrades(false);
      setAppliesLeatherSurcharge(true);
      setAllowsLaseredBrand(false);
      setGradeAUpcharge("");
      setGradeBUpcharge("");
      setGradeEMBUpcharge("");
      setGradeHOHUpcharge("");
      setGradeAxisUpcharge("");
      setGradeBuffaloUpcharge("");
      setComUpcharge("");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError(error instanceof Error ? error.message : "Failed to create choice.");
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 rounded-xl border bg-white p-4">
      <h4 className="text-lg font-semibold">Add Choice</h4>

      <div>
        <label className="mb-1 block text-sm font-medium">Label</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="Tufted"
          required
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Value</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="tufted"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Description</label>
        <textarea
          className="w-full rounded-lg border px-3 py-2"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional short description"
          rows={3}
        />
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

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">Base Price Delta</label>
          <input
            type="number"
            step="0.01"
            className="w-full rounded-lg border px-3 py-2"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
          />
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
      </div>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={usesLeatherGrades}
          onChange={(e) => setUsesLeatherGrades(e.target.checked)}
        />
        Enable leather grade pricing
      </label>

      {usesLeatherGrades ? (
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            checked={appliesLeatherSurcharge}
            onChange={(e) => setAppliesLeatherSurcharge(e.target.checked)}
          />
          Applies Leather Surcharge
        </label>
      ) : null}

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={allowsLaseredBrand}
          onChange={(e) => setAllowsLaseredBrand(e.target.checked)}
        />
        Allows Lasered Brand
      </label>

      {usesLeatherGrades ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Grade A</label>
            <input className="w-full rounded-lg border px-3 py-2" value={gradeAUpcharge} onChange={(e) => setGradeAUpcharge(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade B</label>
            <input className="w-full rounded-lg border px-3 py-2" value={gradeBUpcharge} onChange={(e) => setGradeBUpcharge(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade EMB</label>
            <input className="w-full rounded-lg border px-3 py-2" value={gradeEMBUpcharge} onChange={(e) => setGradeEMBUpcharge(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade HOH</label>
            <input className="w-full rounded-lg border px-3 py-2" value={gradeHOHUpcharge} onChange={(e) => setGradeHOHUpcharge(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade Axis</label>
            <input className="w-full rounded-lg border px-3 py-2" value={gradeAxisUpcharge} onChange={(e) => setGradeAxisUpcharge(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade Buffalo</label>
            <input className="w-full rounded-lg border px-3 py-2" value={gradeBuffaloUpcharge} onChange={(e) => setGradeBuffaloUpcharge(e.target.value)} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">COM</label>
            <input className="w-full rounded-lg border px-3 py-2" value={comUpcharge} onChange={(e) => setComUpcharge(e.target.value)} />
          </div>
        </div>
      ) : null}

      {uploading ? <p className="text-sm text-slate-500">Uploading image...</p> : null}
      {error ? <p className="text-sm font-medium text-red-600">{error}</p> : null}
      {success ? <p className="text-sm font-medium text-green-600">{success}</p> : null}

      <button
        type="submit"
        disabled={loading || uploading}
        className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Add Choice"}
      </button>
    </form>
  );
}