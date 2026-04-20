"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Choice = {
  id: string;
  label: string;
  value: string | null;
  description: string | null;
  imageUrl: string | null;
  priceDelta: number;
  usesLeatherGrades: boolean;
  appliesLeatherSurcharge: boolean;
  allowsLaseredBrand: boolean;
  isBinaryOption: boolean;
  isQuickPick: boolean;
  gradeAUpcharge: number | null;
  gradeBUpcharge: number | null;
  gradeEMBUpcharge: number | null;
  gradeHOHUpcharge: number | null;
  gradeAxisUpcharge: number | null;
  gradeBuffaloUpcharge: number | null;
  comUpcharge: number | null;
  displayOrder: number;
  active: boolean;
};

type Props = {
  groupId: string;
  choice: Choice;
};

export default function OptionChoiceActions({ groupId, choice }: Props) {
  const router = useRouter();

  const [editing, setEditing] = useState(false);

  const [label, setLabel] = useState(choice.label);
  const [value, setValue] = useState(choice.value || "");
  const [description, setDescription] = useState(choice.description || "");
  const [imageUrl, setImageUrl] = useState(choice.imageUrl || "");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [priceDelta, setPriceDelta] = useState(String(choice.priceDelta));
  const [displayOrder, setDisplayOrder] = useState(String(choice.displayOrder));

  const [usesLeatherGrades, setUsesLeatherGrades] = useState(
    choice.usesLeatherGrades
  );
  const [appliesLeatherSurcharge, setAppliesLeatherSurcharge] = useState(
    choice.appliesLeatherSurcharge
  );
  const [allowsLaseredBrand, setAllowsLaseredBrand] = useState(
    choice.allowsLaseredBrand
  );
  const [isBinaryOption, setIsBinaryOption] = useState(choice.isBinaryOption);
  const [isQuickPick, setIsQuickPick] = useState(choice.isQuickPick);
  const [active, setActive] = useState(choice.active);

  const [gradeAUpcharge, setGradeAUpcharge] = useState(
    choice.gradeAUpcharge === null ? "" : String(choice.gradeAUpcharge)
  );
  const [gradeBUpcharge, setGradeBUpcharge] = useState(
    choice.gradeBUpcharge === null ? "" : String(choice.gradeBUpcharge)
  );
  const [gradeEMBUpcharge, setGradeEMBUpcharge] = useState(
    choice.gradeEMBUpcharge === null ? "" : String(choice.gradeEMBUpcharge)
  );
  const [gradeHOHUpcharge, setGradeHOHUpcharge] = useState(
    choice.gradeHOHUpcharge === null ? "" : String(choice.gradeHOHUpcharge)
  );
  const [gradeAxisUpcharge, setGradeAxisUpcharge] = useState(
    choice.gradeAxisUpcharge === null ? "" : String(choice.gradeAxisUpcharge)
  );
  const [gradeBuffaloUpcharge, setGradeBuffaloUpcharge] = useState(
    choice.gradeBuffaloUpcharge === null
      ? ""
      : String(choice.gradeBuffaloUpcharge)
  );
  const [comUpcharge, setComUpcharge] = useState(
    choice.comUpcharge === null ? "" : String(choice.comUpcharge)
  );

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

      const response = await fetch(
        `/api/admin/option-groups/${groupId}/choices/${choice.id}`,
        {
          method: "PUT",
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
            isBinaryOption,
            isQuickPick,
            active,
            gradeAUpcharge: usesLeatherGrades ? gradeAUpcharge : "",
            gradeBUpcharge: usesLeatherGrades ? gradeBUpcharge : "",
            gradeEMBUpcharge: usesLeatherGrades ? gradeEMBUpcharge : "",
            gradeHOHUpcharge: usesLeatherGrades ? gradeHOHUpcharge : "",
            gradeAxisUpcharge: usesLeatherGrades ? gradeAxisUpcharge : "",
            gradeBuffaloUpcharge: usesLeatherGrades ? gradeBuffaloUpcharge : "",
            comUpcharge: usesLeatherGrades ? comUpcharge : "",
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update option choice.");
        setLoading(false);
        return;
      }

      setEditing(false);
      setImageFile(null);
      router.refresh();
    } catch (error) {
      console.error(error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to update option choice."
      );
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(`Delete choice "${choice.label}"?`);

    if (!confirmed) return;

    setLoading(true);
    setError("");

    try {
      const response = await fetch(
        `/api/admin/option-groups/${groupId}/choices/${choice.id}`,
        {
          method: "DELETE",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to delete option choice.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to delete option choice.");
    } finally {
      setLoading(false);
    }
  }

  if (!editing) {
    return (
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Edit Choice
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50"
        >
          Delete Choice
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 space-y-3 rounded-xl border bg-white p-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Label</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Value</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          value={value}
          onChange={(e) => setValue(e.target.value)}
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
        <label className="mb-1 block text-sm font-medium">Upload Image</label>
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
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-sm font-medium">
            Base Price Delta
          </label>
          <input
            type="number"
            step="0.01"
            className="w-full rounded-lg border px-3 py-2"
            value={priceDelta}
            onChange={(e) => setPriceDelta(e.target.value)}
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium">
            Display Order
          </label>
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

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isBinaryOption}
          onChange={(e) => setIsBinaryOption(e.target.checked)}
        />
        Binary Option (Yes/No)
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={isQuickPick}
          onChange={(e) => setIsQuickPick(e.target.checked)}
        />
        Quick Pick
      </label>

      <label className="flex items-center gap-2 text-sm font-medium">
        <input
          type="checkbox"
          checked={active}
          onChange={(e) => setActive(e.target.checked)}
        />
        Active
      </label>

      {usesLeatherGrades ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium">Grade A</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={gradeAUpcharge}
              onChange={(e) => setGradeAUpcharge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade B</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={gradeBUpcharge}
              onChange={(e) => setGradeBUpcharge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade EMB</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={gradeEMBUpcharge}
              onChange={(e) => setGradeEMBUpcharge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade HOH</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={gradeHOHUpcharge}
              onChange={(e) => setGradeHOHUpcharge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">Grade Axis</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={gradeAxisUpcharge}
              onChange={(e) => setGradeAxisUpcharge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">
              Grade Buffalo
            </label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={gradeBuffaloUpcharge}
              onChange={(e) => setGradeBuffaloUpcharge(e.target.value)}
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium">COM</label>
            <input
              className="w-full rounded-lg border px-3 py-2"
              value={comUpcharge}
              onChange={(e) => setComUpcharge(e.target.value)}
            />
          </div>
        </div>
      ) : null}

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
          {loading ? "Saving..." : "Save Choice"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError("");
            setLabel(choice.label);
            setValue(choice.value || "");
            setDescription(choice.description || "");
            setImageUrl(choice.imageUrl || "");
            setImageFile(null);
            setPriceDelta(String(choice.priceDelta));
            setDisplayOrder(String(choice.displayOrder));
            setUsesLeatherGrades(choice.usesLeatherGrades);
            setAppliesLeatherSurcharge(choice.appliesLeatherSurcharge);
            setAllowsLaseredBrand(choice.allowsLaseredBrand);
            setIsBinaryOption(choice.isBinaryOption);
            setIsQuickPick(choice.isQuickPick);
            setActive(choice.active);
            setGradeAUpcharge(
              choice.gradeAUpcharge === null ? "" : String(choice.gradeAUpcharge)
            );
            setGradeBUpcharge(
              choice.gradeBUpcharge === null ? "" : String(choice.gradeBUpcharge)
            );
            setGradeEMBUpcharge(
              choice.gradeEMBUpcharge === null
                ? ""
                : String(choice.gradeEMBUpcharge)
            );
            setGradeHOHUpcharge(
              choice.gradeHOHUpcharge === null
                ? ""
                : String(choice.gradeHOHUpcharge)
            );
            setGradeAxisUpcharge(
              choice.gradeAxisUpcharge === null
                ? ""
                : String(choice.gradeAxisUpcharge)
            );
            setGradeBuffaloUpcharge(
              choice.gradeBuffaloUpcharge === null
                ? ""
                : String(choice.gradeBuffaloUpcharge)
            );
            setComUpcharge(
              choice.comUpcharge === null ? "" : String(choice.comUpcharge)
            );
          }}
          className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}