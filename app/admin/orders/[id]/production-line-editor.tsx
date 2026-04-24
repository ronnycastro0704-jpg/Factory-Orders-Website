"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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

    upholsteryAssignedTo: string | null;
    upholsteredAssignedTo: string | null;
    finalAssemblyAssignedTo: string | null;
    qcAssignedTo: string | null;

    pickedUp: boolean;
    pickedUpAt: string | null;
  };
};

const stageOptions = [
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
  "NA",
];

const priorityOptions = ["NORMAL", "RUSH", "HOLD"];

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

export default function ProductionLineEditor({ line }: Props) {
  const router = useRouter();

  const [bodyLeather, setBodyLeather] = useState(line.bodyLeather || "");
  const [dueDate, setDueDate] = useState(toDateInputValue(line.dueDate));
  const [priority, setPriority] = useState(line.priority || "NORMAL");
  const [lineNotes, setLineNotes] = useState(line.lineNotes || "");

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

  const [upholsteryAssignedTo, setUpholsteryAssignedTo] = useState(
    line.upholsteryAssignedTo || ""
  );
  const [upholsteredAssignedTo, setUpholsteredAssignedTo] = useState(
    line.upholsteredAssignedTo || ""
  );
  const [finalAssemblyAssignedTo, setFinalAssemblyAssignedTo] = useState(
    line.finalAssemblyAssignedTo || ""
  );
  const [qcAssignedTo, setQcAssignedTo] = useState(line.qcAssignedTo || "");

  const [pickedUp, setPickedUp] = useState(line.pickedUp);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSave() {
    setLoading(true);
    setError("");
    setSuccess("");

    try {
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

          upholsteryAssignedTo,
          upholsteredAssignedTo,
          finalAssemblyAssignedTo,
          qcAssignedTo,

          pickedUp,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to update production line.");
        setLoading(false);
        return;
      }

      setSuccess("Production line updated.");
      router.refresh();
    } catch (error) {
      console.error(error);
      setError("Failed to update production line.");
    } finally {
      setLoading(false);
    }
  }

  function renderStageField(
    label: string,
    value: string,
    onChange: (value: string) => void,
    assignedTo?: string,
    onAssignedToChange?: (value: string) => void
  ) {
    return (
      <div className="rounded-xl border bg-slate-50 p-4">
        <label className="mb-2 block text-sm font-medium">{label}</label>
        <select
          className="w-full rounded-lg border bg-white px-3 py-2"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        >
          {stageOptions.map((option) => (
            <option key={option} value={option}>
              {option.replaceAll("_", " ")}
            </option>
          ))}
        </select>

        {onAssignedToChange ? (
          <div className="mt-3">
            <label className="mb-1 block text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
              Assigned To
            </label>
            <input
              className="w-full rounded-lg border bg-white px-3 py-2"
              value={assignedTo || ""}
              onChange={(e) => onAssignedToChange(e.target.value)}
              placeholder="Employee name"
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
            {line.pickedUpAt ? ` · Picked up ${new Date(line.pickedUpAt).toLocaleString()}` : ""}
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
            onChange={(e) => setBodyLeather(e.target.value)}
            placeholder="Body leather"
          />
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Due Date</label>
          <input
            type="date"
            className="w-full rounded-lg border bg-white px-3 py-2"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Priority</label>
          <select
            className="w-full rounded-lg border bg-white px-3 py-2"
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
          >
            {priorityOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded-xl border bg-slate-50 p-4">
          <label className="mb-2 block text-sm font-medium">Picked Up</label>
          <label className="flex items-center gap-2 rounded-lg border bg-white px-3 py-2">
            <input
              type="checkbox"
              checked={pickedUp}
              onChange={(e) => setPickedUp(e.target.checked)}
            />
            <span>{pickedUp ? "Yes" : "No"}</span>
          </label>
        </div>
      </div>

      <div className="mt-4 rounded-xl border bg-slate-50 p-4">
        <label className="mb-2 block text-sm font-medium">Line Notes</label>
        <textarea
          className="w-full rounded-lg border bg-white px-3 py-2"
          rows={3}
          value={lineNotes}
          onChange={(e) => setLineNotes(e.target.value)}
          placeholder="Internal notes for this production line"
        />
      </div>

      <div className="mt-6">
        <h4 className="text-lg font-semibold">Production Stages</h4>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {renderStageField("Mill First", millFirstStatus, setMillFirstStatus)}
          {renderStageField(
            "Leather Ordered",
            leatherOrderedStatus,
            setLeatherOrderedStatus
          )}
          {renderStageField("Mill", millStatus, setMillStatus)}
          {renderStageField(
            "Frame Assembly",
            frameAssemblyStatus,
            setFrameAssemblyStatus
          )}
          {renderStageField(
            "Leather Arrived",
            leatherArrivedStatus,
            setLeatherArrivedStatus
          )}
          {renderStageField("LEA CUT", leaCutStatus, setLeaCutStatus)}
          {renderStageField("Sewn", sewnStatus, setSewnStatus)}
          {renderStageField(
            "Upholstery",
            upholsteryStatus,
            setUpholsteryStatus,
            upholsteryAssignedTo,
            setUpholsteryAssignedTo
          )}
          {renderStageField(
            "Upholstered",
            upholsteredStatus,
            setUpholsteredStatus,
            upholsteredAssignedTo,
            setUpholsteredAssignedTo
          )}
          {renderStageField(
            "Final Assembly",
            finalAssemblyStatus,
            setFinalAssemblyStatus,
            finalAssemblyAssignedTo,
            setFinalAssemblyAssignedTo
          )}
          {renderStageField(
            "QC",
            qcStatus,
            setQcStatus,
            qcAssignedTo,
            setQcAssignedTo
          )}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
      {success ? <p className="mt-4 text-sm text-green-600">{success}</p> : null}

      <div className="mt-6">
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
        >
          {loading ? "Saving..." : "Save Production Line"}
        </button>
      </div>
    </div>
  );
}