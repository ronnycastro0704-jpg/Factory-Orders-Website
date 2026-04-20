"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCurrency } from "../../../../lib/utils";

type Choice = {
  id: string;
  label: string;
  value?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  priceDelta: number;
  usesLeatherGrades: boolean;
  appliesLeatherSurcharge: boolean;
  allowsLaseredBrand: boolean;
  isBinaryOption: boolean;
  gradeAUpcharge: number | null;
  gradeBUpcharge: number | null;
  gradeEMBUpcharge: number | null;
  gradeHOHUpcharge: number | null;
  gradeAxisUpcharge: number | null;
  gradeBuffaloUpcharge: number | null;
  comUpcharge: number | null;
};

type Group = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  choices: Choice[];
};

type Product = {
  id: string;
  name: string;
  basePrice: number;
  optionGroups: Group[];
};

type Leather = {
  id: string;
  name: string;
  slug: string;
  grade: string;
  imageUrl?: string | null;
};

type Props = {
  orderId: string;
  orderNumber: string;
  product: Product;
  leathers: Leather[];
  initialSelectedOptions: Record<string, string[]>;
  initialSelectedLeatherBySelectionKey: Record<string, string>;
  initialSelectedLaseredBrandBySelectionKey: Record<string, "yes" | "no">;
  initialSelectedLaseredBrandImageUrlBySelectionKey: Record<string, string>;
  initialCustomerName: string;
  initialCustomerEmail: string;
  initialCustomerPhone: string;
  initialNotes: string;
};

type PriceLine = {
  label: string;
  amount: number;
};

type SelectedChoiceDetail = {
  groupId: string;
  groupName: string;
  choiceId: string;
  choiceLabel: string;
  baseAmount: number;
  usesLeatherGrades: boolean;
  isBinaryOption: boolean;
  selectedLeather?: Leather;
  leatherSurcharge: number;
  imageUrl?: string | null;
  laseredBrand: boolean;
  laseredBrandImageUrl?: string | null;
};

const SINGLE_APPLY_GRADES = new Set(["Grade A", "Grade B", "COM"]);
const REPEATING_GRADES = new Set([
  "Grade EMB",
  "Grade HOH",
  "Grade Axis",
  "Grade Buffalo",
]);

function makeSelectionKey(groupId: string, choiceId: string) {
  return `${groupId}:::${choiceId}`;
}

function getLeatherSurcharge(choice: Choice, grade: string) {
  if (!choice.appliesLeatherSurcharge) {
    return 0;
  }

  switch (grade) {
    case "Grade A":
      return choice.gradeAUpcharge ?? 0;
    case "Grade B":
      return choice.gradeBUpcharge ?? 0;
    case "Grade EMB":
      return choice.gradeEMBUpcharge ?? 0;
    case "Grade HOH":
      return choice.gradeHOHUpcharge ?? 0;
    case "Grade Axis":
      return choice.gradeAxisUpcharge ?? 0;
    case "Grade Buffalo":
      return choice.gradeBuffaloUpcharge ?? 0;
    case "COM":
      return choice.comUpcharge ?? 0;
    default:
      return 0;
  }
}

function getSingleApplyRank(grade: string) {
  if (grade === "Grade B") return 2;
  if (grade === "Grade A" || grade === "COM") return 1;
  return 0;
}

export default function CustomerOrderEditBuilder({
  orderId,
  orderNumber,
  product,
  leathers,
  initialSelectedOptions,
  initialSelectedLeatherBySelectionKey,
  initialSelectedLaseredBrandBySelectionKey,
  initialSelectedLaseredBrandImageUrlBySelectionKey,
  initialCustomerName,
  initialCustomerEmail,
  initialCustomerPhone,
  initialNotes,
}: Props) {
  const [selectedOptions, setSelectedOptions] =
    useState<Record<string, string[]>>(initialSelectedOptions);

  const [selectedLeatherBySelectionKey, setSelectedLeatherBySelectionKey] =
    useState<Record<string, string>>(initialSelectedLeatherBySelectionKey);

  const [leatherSearchBySelectionKey, setLeatherSearchBySelectionKey] =
    useState<Record<string, string>>({});

  const [selectedLaseredBrandBySelectionKey, setSelectedLaseredBrandBySelectionKey] =
    useState<Record<string, "yes" | "no">>(
      initialSelectedLaseredBrandBySelectionKey
    );

  const [
    selectedLaseredBrandImageUrlBySelectionKey,
    setSelectedLaseredBrandImageUrlBySelectionKey,
  ] = useState<Record<string, string>>(
    initialSelectedLaseredBrandImageUrlBySelectionKey
  );

  const [
    selectedLaseredBrandFileBySelectionKey,
    setSelectedLaseredBrandFileBySelectionKey,
  ] = useState<Record<string, File | null>>({});

  const [customerName, setCustomerName] = useState(initialCustomerName);
  const [customerEmail, setCustomerEmail] = useState(initialCustomerEmail);
  const [customerPhone, setCustomerPhone] = useState(initialCustomerPhone);
  const [notes, setNotes] = useState(initialNotes);
  const [changeReason, setChangeReason] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  function setSingleChoice(groupId: string, choiceId: string) {
    setSelectedOptions((prev) => ({
      ...prev,
      [groupId]: [choiceId],
    }));
  }

  function clearGroupSelection(groupId: string) {
    setSelectedOptions((prev) => {
      const next = { ...prev };
      delete next[groupId];
      return next;
    });
  }

  function toggleMultiChoice(groupId: string, choiceId: string) {
    setSelectedOptions((prev) => {
      const current = prev[groupId] || [];
      const exists = current.includes(choiceId);

      return {
        ...prev,
        [groupId]: exists
          ? current.filter((id) => id !== choiceId)
          : [...current, choiceId],
      };
    });
  }

  async function uploadSingleImage(file: File) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch("/api/uploads", {
      method: "POST",
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Failed to upload image.");
    }

    return data.url as string;
  }

  async function uploadLaseredBrandImagesIfNeeded() {
    const nextUrls = { ...selectedLaseredBrandImageUrlBySelectionKey };

    for (const [selectionKey, file] of Object.entries(
      selectedLaseredBrandFileBySelectionKey
    )) {
      if (!file) continue;

      const brandSelection = selectedLaseredBrandBySelectionKey[selectionKey];
      if (brandSelection !== "yes") continue;

      const uploadedUrl = await uploadSingleImage(file);
      nextUrls[selectionKey] = uploadedUrl;
    }

    setSelectedLaseredBrandImageUrlBySelectionKey(nextUrls);
    return nextUrls;
  }

  const selectedChoiceDetails = useMemo<SelectedChoiceDetail[]>(() => {
    return product.optionGroups.flatMap((group) => {
      const selectedChoiceIds = selectedOptions[group.id] || [];

      return selectedChoiceIds
        .map((choiceId) => {
          const selectedChoice = group.choices.find((choice) => choice.id === choiceId);
          if (!selectedChoice) return null;

          const selectionKey = makeSelectionKey(group.id, selectedChoice.id);
          const selectedLeatherId = selectedLeatherBySelectionKey[selectionKey] || "";
          const selectedLeather = leathers.find(
            (leather) => leather.id === selectedLeatherId
          );

          const leatherSurcharge =
            selectedChoice.usesLeatherGrades && selectedLeather
              ? getLeatherSurcharge(selectedChoice, selectedLeather.grade)
              : 0;

          const laseredBrand =
            selectedChoice.allowsLaseredBrand &&
            selectedLaseredBrandBySelectionKey[selectionKey] === "yes";

          return {
            groupId: group.id,
            groupName: group.name,
            choiceId: selectedChoice.id,
            choiceLabel: selectedChoice.label,
            baseAmount: selectedChoice.priceDelta,
            usesLeatherGrades: selectedChoice.usesLeatherGrades,
            isBinaryOption: selectedChoice.isBinaryOption,
            selectedLeather,
            leatherSurcharge,
            imageUrl: selectedChoice.imageUrl,
            laseredBrand,
            laseredBrandImageUrl: laseredBrand
              ? selectedLaseredBrandImageUrlBySelectionKey[selectionKey] || null
              : null,
          };
        })
        .filter(Boolean) as SelectedChoiceDetail[];
    });
  }, [
    product.optionGroups,
    selectedOptions,
    selectedLeatherBySelectionKey,
    selectedLaseredBrandBySelectionKey,
    selectedLaseredBrandImageUrlBySelectionKey,
    leathers,
  ]);

  const allPriceLines = useMemo<PriceLine[]>(() => {
    const lines: PriceLine[] = [
      {
        label: `${product.name} Base Price`,
        amount: product.basePrice,
      },
    ];

    for (const item of selectedChoiceDetails) {
      lines.push({
        label: item.isBinaryOption
          ? `${item.groupName}: Yes`
          : `${item.groupName}: ${item.choiceLabel}`,
        amount: item.baseAmount,
      });
    }

    const repeatingLeatherItems = selectedChoiceDetails.filter((item) => {
      const grade = item.selectedLeather?.grade;
      return !!grade && REPEATING_GRADES.has(grade) && item.leatherSurcharge > 0;
    });

    for (const item of repeatingLeatherItems) {
      lines.push({
        label: `${item.groupName} - ${item.choiceLabel} Leather: ${item.selectedLeather!.name} (${item.selectedLeather!.grade})`,
        amount: item.leatherSurcharge,
      });
    }

    const singleApplyCandidates = selectedChoiceDetails.filter((item) => {
      const grade = item.selectedLeather?.grade;
      return !!grade && SINGLE_APPLY_GRADES.has(grade) && item.leatherSurcharge > 0;
    });

    if (singleApplyCandidates.length > 0) {
      const highestRank = Math.max(
        ...singleApplyCandidates.map((item) =>
          getSingleApplyRank(item.selectedLeather!.grade)
        )
      );

      const rankedCandidates = singleApplyCandidates.filter(
        (item) => getSingleApplyRank(item.selectedLeather!.grade) === highestRank
      );

      const chosen = rankedCandidates.reduce((highest, current) =>
        current.leatherSurcharge > highest.leatherSurcharge ? current : highest
      );

      lines.push({
        label: `Leather Surcharge (${chosen.selectedLeather!.name} - ${chosen.selectedLeather!.grade}, applied once)`,
        amount: chosen.leatherSurcharge,
      });
    }

    return lines;
  }, [product.name, product.basePrice, selectedChoiceDetails]);

  const total = useMemo(() => {
    return allPriceLines.reduce((sum, line) => sum + line.amount, 0);
  }, [allPriceLines]);

  async function buildSelectionPayload() {
    const uploadedBrandUrls = await uploadLaseredBrandImagesIfNeeded();

    const payloadSelections = selectedChoiceDetails.map((item) => {
      const selectionKey = makeSelectionKey(item.groupId, item.choiceId);

      return {
        groupName: item.groupName,
        choiceLabel: item.isBinaryOption ? "Yes" : item.choiceLabel,
        leatherName: item.selectedLeather?.name || null,
        leatherGrade: item.selectedLeather?.grade || null,
        baseAmount: item.baseAmount,
        leatherSurcharge: item.leatherSurcharge,
        imageUrl: item.imageUrl || null,
        leatherImageUrl: item.selectedLeather?.imageUrl || null,
        laseredBrand: item.laseredBrand,
        laseredBrandImageUrl: item.laseredBrand
          ? uploadedBrandUrls[selectionKey] || item.laseredBrandImageUrl || null
          : null,
      };
    });

    const missingBrandImage = payloadSelections.some(
      (item) => item.laseredBrand && !item.laseredBrandImageUrl
    );

    if (missingBrandImage) {
      throw new Error(
        "Please upload a brand image for every selection marked Lasered Brand."
      );
    }

    return payloadSelections;
  }

  async function handleSaveChanges() {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const payloadSelections = await buildSelectionPayload();

      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          customerName,
          customerEmail,
          customerPhone,
          notes,
          changeReason,
          productName: product.name,
          basePrice: product.basePrice,
          total,
          selections: payloadSelections,
          lineItems: allPriceLines,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error || "Failed to save order changes.");
        return;
      }

      setSaveMessage("Order changes saved successfully.");
      setChangeReason("");
    } catch (error) {
      console.error(error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to save order changes."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    try {
      const payloadSelections = await buildSelectionPayload();

      const response = await fetch("/api/orders/pdf", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productName: product.name,
          customerName,
          customerEmail,
          customerPhone,
          notes,
          total,
          selections: payloadSelections,
          lineItems: allPriceLines,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate PDF.");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${orderNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setSaveError(
        error instanceof Error ? error.message : "Failed to download PDF."
      );
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-6">
        {product.optionGroups.map((group) => {
          const selectedChoiceIds = selectedOptions[group.id] || [];
          const selectedChoicesForGroup = group.choices.filter((choice) =>
            selectedChoiceIds.includes(choice.id)
          );

          const binaryChoice = group.choices.find((choice) => choice.isBinaryOption);
          const isBinaryGroup = Boolean(binaryChoice);
          const binarySelected = binaryChoice
            ? selectedChoiceIds.includes(binaryChoice.id)
            : false;

          const isMultiSelect = group.type === "MULTI_SELECT";

          return (
            <div key={group.id} className="rounded-2xl border p-5 shadow-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-semibold">{group.name}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {group.required ? "Required" : "Optional"}
                    {isMultiSelect ? " · You can select more than one" : ""}
                  </p>
                </div>

                {selectedChoiceIds.length > 0 ? (
                  <span className="rounded-full border bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    {selectedChoiceIds.length} selected
                  </span>
                ) : null}
              </div>

              {isBinaryGroup && binaryChoice ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setSingleChoice(group.id, binaryChoice.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      binarySelected
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">Yes</p>
                      {binarySelected ? (
                        <span className="rounded-full bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white">
                          Selected
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">
                      {binaryChoice.priceDelta === 0
                        ? "Included"
                        : `+${formatCurrency(binaryChoice.priceDelta)}`}
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => clearGroupSelection(group.id)}
                    className={`rounded-xl border p-4 text-left transition ${
                      !binarySelected
                        ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]"
                        : "border-slate-200 bg-white hover:border-slate-400"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-semibold">No</p>
                      {!binarySelected ? (
                        <span className="rounded-full bg-slate-700 px-2 py-1 text-xs font-semibold text-white">
                          Current
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm text-slate-500">No extra charge</p>
                  </button>
                </div>
              ) : isMultiSelect ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.choices.map((choice) => {
                    const isSelected = selectedChoiceIds.includes(choice.id);

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => toggleMultiChoice(group.id, choice.id)}
                        className={`relative overflow-hidden rounded-2xl border text-left transition ${
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        <div className="absolute right-3 top-3 z-10">
                          <div
                            className={`flex h-7 w-7 items-center justify-center rounded-full border text-sm font-bold ${
                              isSelected
                                ? "border-[var(--brand)] bg-[var(--brand)] text-white"
                                : "border-slate-300 bg-white text-slate-400"
                            }`}
                          >
                            {isSelected ? "✓" : ""}
                          </div>
                        </div>

                        {choice.imageUrl ? (
                          <div className="flex h-64 w-full items-center justify-center bg-white p-8">
                            <img
                              src={choice.imageUrl}
                              alt={choice.label}
                              className="max-h-[76%] max-w-[76%] object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-64 w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
                            No Image
                          </div>
                        )}

                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{choice.label}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {choice.description || "No description"}
                              </p>
                            </div>

                            <div className="whitespace-nowrap text-sm font-medium">
                              {choice.priceDelta === 0
                                ? "Included"
                                : `+${formatCurrency(choice.priceDelta)}`}
                            </div>
                          </div>

                          <div className="mt-4">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                isSelected
                                  ? "bg-[var(--brand)] text-white"
                                  : "bg-slate-100 text-slate-600"
                              }`}
                            >
                              {isSelected ? "Selected" : "Click to select"}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {group.choices.map((choice) => {
                    const isSelected = selectedChoiceIds.includes(choice.id);

                    return (
                      <button
                        key={choice.id}
                        type="button"
                        onClick={() => setSingleChoice(group.id, choice.id)}
                        className={`relative overflow-hidden rounded-2xl border text-left transition ${
                          isSelected
                            ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]"
                            : "border-slate-200 bg-white hover:border-slate-400"
                        }`}
                      >
                        {isSelected ? (
                          <div className="absolute right-3 top-3 z-10 rounded-full bg-[var(--brand)] px-2 py-1 text-xs font-semibold text-white">
                            Selected
                          </div>
                        ) : null}

                        {choice.imageUrl ? (
                          <div className="flex h-64 w-full items-center justify-center bg-white p-8">
                            <img
                              src={choice.imageUrl}
                              alt={choice.label}
                              className="max-h-[76%] max-w-[76%] object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-64 w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
                            No Image
                          </div>
                        )}

                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold">{choice.label}</p>
                              <p className="mt-1 text-sm text-slate-500">
                                {choice.description || "No description"}
                              </p>
                            </div>

                            <div className="whitespace-nowrap text-sm font-medium">
                              {choice.priceDelta === 0
                                ? "Included"
                                : `+${formatCurrency(choice.priceDelta)}`}
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {selectedChoicesForGroup.length > 0 ? (
                <div className="mt-5 space-y-4">
                  {selectedChoicesForGroup.map((choice) => {
                    const selectionKey = makeSelectionKey(group.id, choice.id);
                    const leatherSearch =
                      leatherSearchBySelectionKey[selectionKey] || "";

                    const filteredLeathers = leathers.filter((leather) => {
                      const query = leatherSearch.toLowerCase().trim();

                      if (!query) return true;

                      return (
                        leather.name.toLowerCase().includes(query) ||
                        leather.grade.toLowerCase().includes(query) ||
                        leather.slug.toLowerCase().includes(query)
                      );
                    });

                    const selectedLeatherId =
                      selectedLeatherBySelectionKey[selectionKey] || "";
                    const selectedLeather = leathers.find(
                      (leather) => leather.id === selectedLeatherId
                    );

                    return (
                      <div
                        key={selectionKey}
                        className="rounded-xl border bg-slate-50 p-4"
                      >
                        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                          <p className="font-semibold">{choice.label}</p>
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                            Selected
                          </span>
                        </div>

                        {choice.usesLeatherGrades ? (
                          <div className="mb-4 rounded-xl border bg-white p-4">
                            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                              <label className="text-sm font-medium">
                                Leather for {choice.label}
                              </label>
                              {selectedLeather ? (
                                <span className="rounded-full bg-[var(--brand)] px-3 py-1 text-xs font-semibold text-white">
                                  {selectedLeather.name} · {selectedLeather.grade}
                                </span>
                              ) : null}
                            </div>

                            <input
                              type="text"
                              value={leatherSearch}
                              onChange={(e) =>
                                setLeatherSearchBySelectionKey((prev) => ({
                                  ...prev,
                                  [selectionKey]: e.target.value,
                                }))
                              }
                              placeholder="Search leather by name or grade..."
                              className="mb-3 w-full rounded-lg border bg-white px-3 py-2"
                            />

                            <div className="mb-3 flex items-center justify-between text-xs text-slate-500">
                              <span>
                                {filteredLeathers.length} leather
                                {filteredLeathers.length === 1 ? "" : "s"} found
                              </span>
                              {selectedLeatherId ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setSelectedLeatherBySelectionKey((prev) => ({
                                      ...prev,
                                      [selectionKey]: "",
                                    }))
                                  }
                                  className="rounded-lg border px-2 py-1 hover:bg-slate-50"
                                >
                                  Clear
                                </button>
                              ) : null}
                            </div>

                            {filteredLeathers.length === 0 ? (
                              <div className="rounded-xl border border-dashed p-6 text-center text-sm text-slate-500">
                                No leathers found.
                              </div>
                            ) : (
                              <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 xl:grid-cols-3">
                                {filteredLeathers.map((leather) => {
                                  const isSelectedLeather =
                                    selectedLeatherId === leather.id;

                                  return (
                                    <button
                                      key={leather.id}
                                      type="button"
                                      onClick={() =>
                                        setSelectedLeatherBySelectionKey((prev) => ({
                                          ...prev,
                                          [selectionKey]: leather.id,
                                        }))
                                      }
                                      className={`overflow-hidden rounded-xl border text-left transition ${
                                        isSelectedLeather
                                          ? "border-[var(--brand)] bg-[var(--brand-soft)] ring-2 ring-[var(--brand)]"
                                          : "border-slate-200 bg-white hover:border-slate-400"
                                      }`}
                                    >
                                      <div className="flex h-28 items-center justify-center bg-white p-3">
                                        {leather.imageUrl ? (
                                          <img
                                            src={leather.imageUrl}
                                            alt={leather.name}
                                            className="max-h-full max-w-full object-contain"
                                          />
                                        ) : (
                                          <div className="text-xs text-slate-400">
                                            No Image
                                          </div>
                                        )}
                                      </div>

                                      <div className="p-3">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="font-semibold text-slate-900">
                                            {leather.name}
                                          </p>
                                          {isSelectedLeather ? (
                                            <span className="rounded-full bg-[var(--brand)] px-2 py-1 text-[10px] font-semibold text-white">
                                              Selected
                                            </span>
                                          ) : null}
                                        </div>

                                        <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">
                                          {leather.grade}
                                        </p>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        ) : null}

                        {choice.allowsLaseredBrand ? (
                          <div>
                            <label className="mb-2 block text-sm font-medium">
                              Lasered Brand for {choice.label}
                            </label>
                            <select
                              className="w-full rounded-lg border bg-white px-3 py-2"
                              value={selectedLaseredBrandBySelectionKey[selectionKey] || "no"}
                              onChange={(e) =>
                                setSelectedLaseredBrandBySelectionKey((prev) => ({
                                  ...prev,
                                  [selectionKey]: e.target.value as "yes" | "no",
                                }))
                              }
                            >
                              <option value="no">No</option>
                              <option value="yes">Yes</option>
                            </select>

                            {selectedLaseredBrandBySelectionKey[selectionKey] === "yes" ? (
                              <div className="mt-4 space-y-3">
                                <div>
                                  <label className="mb-1 block text-sm font-medium">
                                    Upload Brand Image
                                  </label>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    className="w-full rounded-lg border bg-white px-3 py-2"
                                    onChange={(e) =>
                                      setSelectedLaseredBrandFileBySelectionKey((prev) => ({
                                        ...prev,
                                        [selectionKey]: e.target.files?.[0] || null,
                                      }))
                                    }
                                  />
                                </div>

                                {selectedLaseredBrandImageUrlBySelectionKey[selectionKey] ? (
                                  <img
                                    src={selectedLaseredBrandImageUrlBySelectionKey[selectionKey]}
                                    alt="Lasered brand preview"
                                    className="h-32 w-32 rounded-lg border object-contain bg-white p-2"
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              ) : null}
            </div>
          );
        })}

        <div className="rounded-2xl border p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Customer Information</h2>

          <div className="mt-4 space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium">Name</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                className="w-full rounded-lg border px-3 py-2"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">
                Change Reason
              </label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                placeholder="Example: changed inside back style"
              />
            </div>

            {saveError ? (
              <p className="text-sm font-medium text-red-600">{saveError}</p>
            ) : null}

            {saveMessage ? (
              <p className="text-sm font-medium text-green-600">{saveMessage}</p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSaveChanges}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Order Changes"}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100"
              >
                Download PDF
              </button>

              <Link
                href="/admin/orders"
                className="rounded-lg border px-4 py-2 hover:bg-slate-100"
              >
                Admin Orders
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="h-fit rounded-2xl border p-6 shadow-sm">
        <h2 className="text-2xl font-semibold">Itemized Price</h2>

        <div className="mt-4 space-y-3">
          {allPriceLines.map((line) => (
            <div
              key={`${line.label}-${line.amount}`}
              className="flex justify-between border-b pb-2"
            >
              <span>{line.label}</span>
              <span>
                {line.amount === 0 ? "Included" : `+${formatCurrency(line.amount)}`}
              </span>
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-between text-xl font-bold">
          <span>Total</span>
          <span>{formatCurrency(total)}</span>
        </div>
      </div>
    </div>
  );
}