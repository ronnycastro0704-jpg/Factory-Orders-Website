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
      return "border-amber-200 bg-amber-50 text-amber-700";
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

export default function ProductionLineEditor({ line }: Props) {
  const router = useRouter();

  const [bodyLeather, setBodyLeather] = useState(line.bodyLeather || "");
  const [dueDate, setDueDate] = useState(toDateInputValue(line.dueDate));
  const [priority, setPriority] = useState(toUiPriority(line.priority));
  const [lineNotes, setLineNotes] = useState(line.lineNotes || "");
  const [pickedUpAt, setPickedUpAt] = useState(toDateInputValue(line.pickedUpAt));
  const [completedPhotoUrl, setCompletedPhotoUrl] = useState(
    line.completedPhotoUrl || ""
  );
  const [completedPhotoFile, setCompletedPhotoFile] = useState<File | null>(null);

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

  async function uploadCompletedPhotoIfNeeded() {
    if (!completedPhotoFile) {
      return completedPhotoUrl;
    }

    setUploading(true);

    const formData = new FormData();
    formData.append("file", completedPhotoFile);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();
    setUploading(false);

    if (!response.ok) {
      throw new Error(data.error || "Failed to upload completed photo.");
    }

    return String(data.url || "");
  }

  async function handleSave() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const finalCompletedPhotoUrl = await uploadCompletedPhotoIfNeeded();

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
          completedPhotoUrl: finalCompletedPhotoUrl,

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

      setCompletedPhotoUrl(finalCompletedPhotoUrl);
      setCompletedPhotoFile(null);
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
    setCompletedPhotoFile(event.target.files?.[0] || null);
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
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <div className="lg:w-64">
            <label className="mb-2 block text-sm font-medium">
              Completed Furniture Photo
            </label>

            {completedPhotoUrl ? (
              <img
                src={completedPhotoUrl}
                alt={`${line.partNumber} completed`}
                className="h-48 w-full rounded-xl border object-cover"
              />
            ) : (
              <div className="flex h-48 w-full items-center justify-center rounded-xl border border-dashed bg-white text-sm text-slate-400">
                No photo uploaded
              </div>
            )}
          </div>

          <div className="flex-1 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Upload Photo
              </label>
              <input
                type="file"
                accept="image/*"
                className="w-full rounded-lg border bg-white px-3 py-2"
                onChange={handleCompletedPhotoFileChange}
              />
              {completedPhotoFile ? (
                <p className="mt-2 text-xs text-slate-500">
                  Selected file: {completedPhotoFile.name}
                </p>
              ) : null}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Or Paste Photo URL
              </label>
              <input
                className="w-full rounded-lg border bg-white px-3 py-2"
                value={completedPhotoUrl}
                onChange={(event) => setCompletedPhotoUrl(event.target.value)}
                placeholder="https://..."
              />
            </div>

            <button
              type="button"
              onClick={() => {
                setCompletedPhotoUrl("");
                setCompletedPhotoFile(null);
              }}
              className="rounded-lg border px-3 py-2 hover:bg-slate-100"
            >
              Clear Photo
            </button>
          </div>
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
        <p className="mt-4 text-sm text-slate-500">Uploading photo...</p>
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
          {loading ? "Saving..." : "Save Production Line"}
        </button>
      </div>
    </div>
  );
}