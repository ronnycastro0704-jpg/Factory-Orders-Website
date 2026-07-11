"use client";

import { useRouter } from "next/navigation";
import { ChangeEvent, useState } from "react";

type Props = {
  line: {
    id: string;
    partNumber: string;
    frameNeeded: string;
    quantity: number;
    bodyLeather: string | null;
    dueDate: string | null;
    priority: string;
    currentStatus: string;
    lineNotes: string | null;
    completedPhotoUrl: string | null;
    completedPhotoUrls?: string[] | null;

    millFirstStatus: string;
    leatherOrderedStatus: string;
    millStatus: string;
    frameAssemblyStatus: string;
    leatherArrivedStatus: string;
    leaCutStatus: string;
    sewnStatus: string;
    upholsteryStatus: string;
    upholsteredStatus: string;
    finalAssemblyStatus: string;
    qcStatus: string;

    leaCutAssignedTo: string | null;
    upholsteryAssignedTo: string | null;
    upholsteredAssignedTo: string | null;
    finalAssemblyAssignedTo: string | null;
    qcAssignedTo: string | null;

    pickedUp: boolean;
    pickedUpAt: string | null;
  };
};

type StageOption = {
  value: string;
  label: string;
};

const MILL_FIRST_OPTIONS: StageOption[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "HOT", label: "Hot" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "FRAME_DONE", label: "Frame Done" },
  { value: "THIS_WEEK", label: "This Week" },
  { value: "DONE", label: "Done" },
  { value: "NA", label: "N/A" },
];

const GENERIC_STAGE_OPTIONS: StageOption[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
  { value: "NA", label: "N/A" },
];

const LEA_CUT_OPTIONS: StageOption[] = [
  { value: "NOT_STARTED", label: "Not Started" },
  { value: "IN_PROGRESS", label: "In Progress" },
  { value: "DONE", label: "Done" },
  { value: "MISSING_LEATHER", label: "Missing Leather" },
  { value: "NA", label: "N/A" },
];

const PRIORITY_OPTIONS = ["NORMAL", "RUSH", "HOT"];

function formatBadge(status: string) {
  switch (status) {
    case "BLOCKED":
      return "bg-red-50 text-red-700 border-red-200";
    case "READY":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "PICKED_UP":
      return "bg-purple-50 text-purple-700 border-purple-200";
    case "CUTTING":
    case "SEWING":
    case "UPHOLSTERY":
    case "FINAL_ASSEMBLY":
    case "QC":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "WAITING_ON_LEATHER":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

function toDateInputValue(value: string | null) {
  if (!value) return "";
  return value.slice(0, 10);
}

function toUiPriority(value: string) {
  return value === "HOLD" ? "HOT" : value || "NORMAL";
}

function formatStageLabel(value: string) {
  switch (value) {
    case "NOT_STARTED":
      return "Not Started";
    case "HOT":
      return "Hot";
    case "IN_PROGRESS":
      return "In Progress";
    case "FRAME_DONE":
      return "Frame Done";
    case "THIS_WEEK":
      return "This Week";
    case "DONE":
      return "Done";
    case "MISSING_LEATHER":
      return "Missing Leather";
    case "BLOCKED":
      return "Blocked";
    case "NA":
      return "N/A";
    default:
      return value.replaceAll("_", " ");
  }
}

function getStageToneClasses(value: string) {
  switch (value) {
    case "NOT_STARTED":
      return "border-red-200 bg-red-50 text-red-700";
    case "HOT":
      return "border-orange-200 bg-orange-50 text-orange-700";
    case "IN_PROGRESS":
      return "border-lime-200 bg-lime-50 text-lime-800";
    case "FRAME_DONE":
      return "border-sky-200 bg-sky-50 text-sky-700";
    case "THIS_WEEK":
      return "border-amber-50 bg-amber-50 text-amber-700";
    case "DONE":
      return "border-emerald-300 bg-emerald-100 text-emerald-800";
    case "MISSING_LEATHER":
      return "border-rose-200 bg-rose-50 text-rose-700";
    case "BLOCKED":
      return "border-red-300 bg-red-100 text-red-800";
    case "NA":
      return "border-slate-200 bg-slate-100 text-slate-600";
    default:
      return "border-slate-200 bg-white text-slate-700";
  }
}

function getResolvedOptions(options: StageOption[], value: string) {
  if (options.some((option) => option.value === value)) {
    return options;
  }

  return [
    ...options,
    {
      value,
      label: formatStageLabel(value),
    },
  ];
}

function buildInitialPhotoUrls(line: Props["line"]) {
  return Array.from(
    new Set([
      ...(line.completedPhotoUrls || []),
      ...(line.completedPhotoUrl ? [line.completedPhotoUrl] : []),
    ])
  ).filter(Boolean);
}

export default function ProductionLineEditor({ line }: Props) {
  const router = useRouter();

  const [bodyLeather, setBodyLeather] = useState(line.bodyLeather || "");
  const [dueDate, setDueDate] = useState(toDateInputValue(line.dueDate));
  const [priority, setPriority] = useState(toUiPriority(line.priority));
  const [lineNotes, setLineNotes] = useState(line.lineNotes || "");
  const [pickedUpAt, setPickedUpAt] = useState(toDateInputValue(line.pickedUpAt));
  const [completedPhotoUrls, setCompletedPhotoUrls] = useState<string[]>(
    buildInitialPhotoUrls(line)
  );
  const [completedPhotoFiles, setCompletedPhotoFiles] = useState<File[]>([]);
  const [photoUrlInput, setPhotoUrlInput] = useState("");

  const [millFirstStatus, setMillFirstStatus] = useState(line.millFirstStatus);
  const [leatherOrderedStatus, setLeatherOrderedStatus] = useState(
    line.leatherOrderedStatus
  );
  const [millStatus, setMillStatus] = useState(line.millStatus);
  const [frameAssemblyStatus, setFrameAssemblyStatus] = useState(
    line.frameAssemblyStatus
  );
  const [leatherArrivedStatus, setLeatherArrivedStatus] = useState(
    line.leatherArrivedStatus
  );
  const [leaCutStatus, setLeaCutStatus] = useState(line.leaCutStatus);
  const [sewnStatus, setSewnStatus] = useState(line.sewnStatus);
  const [upholsteryStatus, setUpholsteryStatus] = useState(line.upholsteryStatus);
  const [upholsteredStatus, setUpholsteredStatus] = useState(
    line.upholsteredStatus
  );
  const [finalAssemblyStatus, setFinalAssemblyStatus] = useState(
    line.finalAssemblyStatus
  );
  const [qcStatus, setQcStatus] = useState(line.qcStatus);

  const [leaCutAssignedTo, setLeaCutAssignedTo] = useState(
    line.leaCutAssignedTo || ""
  );
  const [upholsteredAssignedTo, setUpholsteredAssignedTo] = useState(
    line.upholsteredAssignedTo || ""
  );
  const [qcAssignedTo, setQcAssignedTo] = useState(line.qcAssignedTo || "");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function uploadCompletedPhotosIfNeeded() {
    if (completedPhotoFiles.length === 0) {
      return completedPhotoUrls;
    }

    setUploading(true);

    const uploadedUrls: string[] = [];

    for (const file of completedPhotoFiles) {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload completed photo.");
      }

      const url = String(data.url || "").trim();

      if (url) {
        uploadedUrls.push(url);
      }
    }

    return Array.from(new Set([...completedPhotoUrls, ...uploadedUrls]));
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const finalCompletedPhotoUrls = await uploadCompletedPhotosIfNeeded();

      const response = await fetch(`/api/admin/production-lines/${line.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          bodyLeather,
          dueDate,
          priority,
          lineNotes,
          pickedUpAt,
          completedPhotoUrl: finalCompletedPhotoUrls[0] || "",
          completedPhotoUrls: finalCompletedPhotoUrls,

          millFirstStatus,
          leatherOrderedStatus,
          millStatus,
          frameAssemblyStatus,
          leatherArrivedStatus,
          leaCutStatus,
          sewnStatus,
          upholsteryStatus,
          upholsteredStatus,
          finalAssemblyStatus,
          qcStatus,

          leaCutAssignedTo,
          upholsteredAssignedTo,
          qcAssignedTo,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update production line.");
        setLoading(false);
        return;
      }

      setCompletedPhotoUrls(finalCompletedPhotoUrls);
      setCompletedPhotoFiles([]);
      setPhotoUrlInput("");
      setSuccess("Production line updated.");
      router.refresh();
    } catch (saveError) {
      console.error(saveError);
      setError(
        saveError instanceof Error
          ? saveError.message
          : "Failed to update production line."
      );
    } finally {
      setLoading(false);
      setUploading(false);
    }
  }

  function handleCompletedPhotoFileChange(event: ChangeEvent<HTMLInputElement>) {
    setCompletedPhotoFiles(Array.from(event.target.files || []));
  }

  async function uploadSelectedCompletedPhotos() {
  if (completedPhotoFiles.length === 0) {
    setError("Please choose one or more photos first.");
    return;
  }

  setUploading(true);
  setError("");
  setSuccess("");

  try {
    const uploadedUrls: string[] = [];

    for (const file of completedPhotoFiles) {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload completed photo.");
      }

      const url = String(data.url || "").trim();

      if (url) {
        uploadedUrls.push(url);
      }
    }

    setCompletedPhotoUrls((currentUrls) =>
      Array.from(new Set([...currentUrls, ...uploadedUrls]))
    );

    setCompletedPhotoFiles([]);
    setSuccess(
      uploadedUrls.length === 1
        ? "Photo added. Click Save Production Line to save it."
        : "Photos added. Click Save Production Line to save them."
    );
  } catch (uploadError) {
    console.error(uploadError);
    setError(
      uploadError instanceof Error
        ? uploadError.message
        : "Failed to upload selected photos."
    );
  } finally {
    setUploading(false);
  }
}

  function addPhotoUrl() {
    const nextUrl = photoUrlInput.trim();

    if (!nextUrl) {
      return;
    }

    setCompletedPhotoUrls((currentUrls) =>
      Array.from(new Set([...currentUrls, nextUrl]))
    );
    setPhotoUrlInput("");
  }

  function removeCompletedPhoto(urlToRemove: string) {
    setCompletedPhotoUrls((currentUrls) =>
      currentUrls.filter((url) => url !== urlToRemove)
    );
  }

  function clearSelectedUploadFiles() {
    setCompletedPhotoFiles([]);
  }

  function renderStageField(args: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: StageOption[];
    assignedTo?: string;
    onAssignedToChange?: (value: string) => void;
    assignedToPlaceholder?: string;
  }) {
    const resolvedOptions = getResolvedOptions(args.options, args.value);

    return (
      <div className="rounded-xl border bg-slate-50 p-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <label className="block text-sm font-medium">{args.label}</label>
          <span
            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${getStageToneClasses(
              args.value
            )}`}
          >
            {formatStageLabel(args.value)}
          </span>
        </div>

        <select
          className={`w-full rounded-lg border px-3 py-2 font-medium ${getStageToneClasses(
            args.value
          )}`}
          value={args.value}
          onChange={(event) => args.onChange(event.target.value)}
        >
          {resolvedOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        {args.onAssignedToChange ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              Assigned To
            </label>
            <input
              className="w-full rounded-lg border bg-white px-3 py-2"
              value={args.assignedTo || ""}
              onChange={(event) => args.onAssignedToChange?.(event.target.value)}
              placeholder={args.assignedToPlaceholder || "Employee name"}
            />
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-white p-6 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-xl font-semibold">
              {line.partNumber} / {line.frameNeeded}
            </h3>
            <span
              className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${formatBadge(
                line.currentStatus
              )}`}
            >
              {line.currentStatus.replaceAll("_", " ")}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-500">
            Qty {line.quantity}
            {line.pickedUpAt
              ? ` · Picked up ${new Date(line.pickedUpAt).toLocaleDateString()}`
              : ""}
          </p>
        </div>

        <div className="rounded-xl border bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Current status is auto-calculated from stage progress.
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Body Leather</label>
          <input
            className="w-full rounded-lg border bg-white px-3 py-2"
            value={bodyLeather}
            onChange={(event) => setBodyLeather(event.target.value)}
            placeholder="Body leather"
          />
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Due Date</label>
          <input
            type="date"
            className="w-full rounded-lg border bg-white px-3 py-2"
            value={dueDate}
            onChange={(event) => setDueDate(event.target.value)}
          />
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Priority</label>
          <select
            className={`w-full rounded-lg border px-3 py-2 font-medium ${
              priority === "HOT"
                ? "border-orange-200 bg-orange-50 text-orange-700"
                : priority === "RUSH"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-slate-200 bg-slate-50 text-slate-700"
            }`}
            value={priority}
            onChange={(event) => setPriority(event.target.value)}
          >
            {PRIORITY_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Picked Up Date</label>
          <div className="flex gap-2">
            <input
              type="date"
              className="w-full rounded-lg border bg-white px-3 py-2"
              value={pickedUpAt}
              onChange={(event) => setPickedUpAt(event.target.value)}
            />
            <button
              type="button"
              onClick={() => setPickedUpAt("")}
              className="rounded-lg border px-3 py-2 hover:bg-slate-100"
            >
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-slate-50 p-4">
        <label className="mb-2 block text-sm font-medium">Line Notes</label>
        <textarea
          className="w-full rounded-lg border bg-white px-3 py-2"
          rows={3}
          value={lineNotes}
          onChange={(event) => setLineNotes(event.target.value)}
          placeholder="Internal notes for this production line"
        />
      </div>

      <div className="mt-4 rounded-xl border bg-slate-50 p-4">
        <div className="flex flex-col gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium">
              Completed Furniture Photos
            </label>

            {completedPhotoUrls.length > 0 ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {completedPhotoUrls.map((url, index) => (
                  <div key={url} className="rounded-xl border bg-white p-3">
                    <img
                      src={url}
                      alt={`${line.partNumber} completed photo ${index + 1}`}
                      className="h-48 w-full rounded-lg border object-cover"
                    />

                    <div className="mt-3 flex items-center justify-between gap-3">
                      <p className="text-xs font-medium text-slate-500">
                        Photo {index + 1}
                      </p>

                      <button
                        type="button"
                        onClick={() => removeCompletedPhoto(url)}
                        className="rounded-lg border px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed bg-white text-sm text-slate-400">
                No completed photos uploaded
              </div>
            )}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Upload Photos
              </label>
<input
  type="file"
  accept="image/*"
  multiple
  className="w-full rounded-lg border bg-white px-3 py-2"
  onChange={handleCompletedPhotoFileChange}
/>

{completedPhotoFiles.length > 0 ? (
  <div className="mt-2 space-y-2 text-xs text-slate-500">
    <p>{completedPhotoFiles.length} file(s) selected:</p>

    <ul className="list-disc pl-5">
      {completedPhotoFiles.map((file) => (
        <li key={`${file.name}-${file.lastModified}`}>
          {file.name}
        </li>
      ))}
    </ul>

    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        onClick={uploadSelectedCompletedPhotos}
        disabled={uploading}
        className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {uploading ? "Uploading..." : "Upload Selected Photos"}
      </button>

      <button
        type="button"
        onClick={clearSelectedUploadFiles}
        disabled={uploading}
        className="rounded-lg border px-3 py-2 text-xs hover:bg-slate-100 disabled:opacity-50"
      >
        Clear selected files
      </button>
    </div>
  </div>
) : null}

              <p className="mt-2 text-xs text-slate-500">
                You can select multiple photos at once, for example front and
                back.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Or Paste Photo URL
              </label>

              <div className="flex gap-2">
                <input
                  className="w-full rounded-lg border bg-white px-3 py-2"
                  value={photoUrlInput}
                  onChange={(event) => setPhotoUrlInput(event.target.value)}
                  placeholder="https://..."
                />

<button
  type="button"
  onClick={addPhotoUrl}
  className="rounded-lg border px-3 py-2 hover:bg-slate-100"
>
  Add URL
</button>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Pasted URLs are added to the saved photo gallery.
              </p>
            </div>
          </div>

          {completedPhotoUrls.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setCompletedPhotoUrls([]);
                setCompletedPhotoFiles([]);
                setPhotoUrlInput("");
              }}
              className="w-fit rounded-lg border px-3 py-2 text-sm text-red-600 hover:bg-red-50"
            >
              Clear All Photos
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-6">
        <h4 className="text-lg font-semibold">Production Stages</h4>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {renderStageField({
            label: "MILL FIRST",
            value: millFirstStatus,
            onChange: setMillFirstStatus,
            options: MILL_FIRST_OPTIONS,
          })}

          {renderStageField({
            label: "Leather Ordered",
            value: leatherOrderedStatus,
            onChange: setLeatherOrderedStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "MILL",
            value: millStatus,
            onChange: setMillStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "Frame Assembly",
            value: frameAssemblyStatus,
            onChange: setFrameAssemblyStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "Leather Arrived",
            value: leatherArrivedStatus,
            onChange: setLeatherArrivedStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "LEA CUT",
            value: leaCutStatus,
            onChange: setLeaCutStatus,
            options: LEA_CUT_OPTIONS,
            assignedTo: leaCutAssignedTo,
            onAssignedToChange: setLeaCutAssignedTo,
          })}

          {renderStageField({
            label: "Sewn",
            value: sewnStatus,
            onChange: setSewnStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "Upholstery",
            value: upholsteryStatus,
            onChange: setUpholsteryStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "Upholstered",
            value: upholsteredStatus,
            onChange: setUpholsteredStatus,
            options: GENERIC_STAGE_OPTIONS,
            assignedTo: upholsteredAssignedTo,
            onAssignedToChange: setUpholsteredAssignedTo,
          })}

          {renderStageField({
            label: "Final Assembly",
            value: finalAssemblyStatus,
            onChange: setFinalAssemblyStatus,
            options: GENERIC_STAGE_OPTIONS,
          })}

          {renderStageField({
            label: "QC'ED",
            value: qcStatus,
            onChange: setQcStatus,
            options: GENERIC_STAGE_OPTIONS,
            assignedTo: qcAssignedTo,
            onAssignedToChange: setQcAssignedTo,
          })}
        </div>
      </div>

      {uploading ? (
        <p className="mt-4 text-sm text-slate-500">Uploading photos...</p>
      ) : null}
      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-green-600">{success}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading || uploading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading || uploading ? "Saving..." : "Save Production Line"}
        </button>
      </div>
    </div>
  );
}