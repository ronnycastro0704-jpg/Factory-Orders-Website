"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "../../../lib/utils";
import Link from "next/link";

type Choice = {
  id: string;
  label: string;
  value?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  priceDelta: number;
  usesLeatherGrades: boolean;
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
  product: Product;
  leathers: Leather[];
};

type PriceLine = {
  label: string;
  amount: number;
};

type SelectedChoiceDetail = {
  groupId: string;
  groupName: string;
  choiceLabel: string;
  baseAmount: number;
  usesLeatherGrades: boolean;
  selectedLeather?: Leather;
  leatherSurcharge: number;
  imageUrl?: string | null;
};

const SINGLE_APPLY_GRADES = new Set(["Grade A", "Grade B", "COM"]);
const REPEATING_GRADES = new Set([
  "Grade EMB",
  "Grade HOH",
  "Grade Axis",
  "Grade Buffalo",
]);

function getLeatherSurcharge(choice: Choice, grade: string) {
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

export default function ProductBuilder({ product, leathers }: Props) {
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>(
    {}
  );

  const [selectedLeatherByGroupId, setSelectedLeatherByGroupId] = useState<
    Record<string, string>
  >({});

  const [savedOrderId, setSavedOrderId] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveError, setSaveError] = useState("");

  const selectedChoiceDetails = useMemo<SelectedChoiceDetail[]>(() => {
    return product.optionGroups
      .map((group) => {
        const selectedChoiceId = selectedOptions[group.id];
        const selectedChoice = group.choices.find(
          (choice) => choice.id === selectedChoiceId
        );

        if (!selectedChoice) return null;

        const selectedLeatherId = selectedLeatherByGroupId[group.id] || "";
        const selectedLeather = leathers.find(
          (leather) => leather.id === selectedLeatherId
        );

        const leatherSurcharge =
          selectedChoice.usesLeatherGrades && selectedLeather
            ? getLeatherSurcharge(selectedChoice, selectedLeather.grade)
            : 0;

        return {
          groupId: group.id,
          groupName: group.name,
          choiceLabel: selectedChoice.label,
          baseAmount: selectedChoice.priceDelta,
          usesLeatherGrades: selectedChoice.usesLeatherGrades,
          selectedLeather,
          leatherSurcharge,
          imageUrl: selectedChoice.imageUrl,
        };
      })
      .filter(Boolean) as SelectedChoiceDetail[];
  }, [product.optionGroups, selectedOptions, selectedLeatherByGroupId, leathers]);

  const allPriceLines = useMemo<PriceLine[]>(() => {
    const lines: PriceLine[] = [
      {
        label: `${product.name} Base Price`,
        amount: product.basePrice,
      },
    ];

    for (const item of selectedChoiceDetails) {
      lines.push({
        label: `${item.groupName}: ${item.choiceLabel}`,
        amount: item.baseAmount,
      });
    }

    const repeatingLeatherItems = selectedChoiceDetails.filter((item) => {
      const grade = item.selectedLeather?.grade;
      return !!grade && REPEATING_GRADES.has(grade);
    });

    for (const item of repeatingLeatherItems) {
      lines.push({
        label: `${item.groupName} Leather: ${item.selectedLeather!.name} (${item.selectedLeather!.grade})`,
        amount: item.leatherSurcharge,
      });
    }

    const singleApplyCandidates = selectedChoiceDetails.filter((item) => {
      const grade = item.selectedLeather?.grade;
      return !!grade && SINGLE_APPLY_GRADES.has(grade);
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

  async function handleSendToFactory() {
    setSaving(true);
    setSaveError("");
    setSaveMessage("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          customerName,
          customerEmail,
          customerPhone,
          notes,
          basePrice: product.basePrice,
          total,
          submitToFactory: true,
          selections: selectedChoiceDetails.map((item) => ({
            groupName: item.groupName,
            choiceLabel: item.choiceLabel,
            leatherName: item.selectedLeather?.name || null,
            leatherGrade: item.selectedLeather?.grade || null,
            baseAmount: item.baseAmount,
            leatherSurcharge: item.leatherSurcharge,
            imageUrl: item.imageUrl || null,
            leatherImageUrl: item.selectedLeather?.imageUrl || null,
          })),
          lineItems: allPriceLines,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error || "Failed to send order to factory.");
        setSaving(false);
        return;
      }

      setSavedOrderId(data.id);
      setSaveMessage(`Order sent to factory: ${data.orderNumber}`);
    } catch (error) {
      console.error(error);
      setSaveError("Failed to send order to factory.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDownloadPdf() {
    try {
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
          selections: selectedChoiceDetails.map((item) => ({
            groupName: item.groupName,
            choiceLabel: item.choiceLabel,
            leatherName: item.selectedLeather?.name || null,
            leatherGrade: item.selectedLeather?.grade || null,
            baseAmount: item.baseAmount,
            leatherSurcharge: item.leatherSurcharge,
            imageUrl: item.imageUrl || null,
            leatherImageUrl: item.selectedLeather?.imageUrl || null,
          })),
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
      a.download = "order-draft.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error(error);
      setSaveError("Failed to download PDF.");
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_0.8fr]">
      <div className="space-y-6">
        {product.optionGroups.map((group) => {
          const selectedChoiceId = selectedOptions[group.id];
          const selectedChoice = group.choices.find(
            (choice) => choice.id === selectedChoiceId
          );

          return (
            <div key={group.id} className="rounded-2xl border p-5 shadow-sm">
              <h2 className="text-xl font-semibold">{group.name}</h2>
              <p className="mb-4 mt-1 text-sm text-slate-500">
                {group.required ? "Required" : "Optional"}
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                {group.choices.map((choice) => {
                  const isSelected = selectedChoiceId === choice.id;

                  return (
                    <button
                      key={choice.id}
                      type="button"
                      onClick={() =>
                        setSelectedOptions((prev) => ({
                          ...prev,
                          [group.id]: choice.id,
                        }))
                      }
                      className={`overflow-hidden rounded-xl border text-left transition ${
                        isSelected
                          ? "border-slate-900 ring-2 ring-slate-900"
                          : "border-slate-200 hover:border-slate-400"
                      }`}
                    >
                      {choice.imageUrl ? (
                        <img
                          src={choice.imageUrl}
                          alt={choice.label}
                          className="h-40 w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-40 w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
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

              {selectedChoice?.usesLeatherGrades ? (
                <div className="mt-5 rounded-xl border bg-slate-50 p-4">
                  <label className="mb-2 block text-sm font-medium">
                    Leather
                  </label>
                  <select
                    className="w-full rounded-lg border bg-white px-3 py-2"
                    value={selectedLeatherByGroupId[group.id] || ""}
                    onChange={(e) =>
                      setSelectedLeatherByGroupId((prev) => ({
                        ...prev,
                        [group.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">Select leather</option>
                    {leathers.map((leather) => (
                      <option key={leather.id} value={leather.id}>
                        {leather.name}
                      </option>
                    ))}
                  </select>
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
                placeholder="Customer name"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Email</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
                placeholder="customer@email.com"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Phone</label>
              <input
                className="w-full rounded-lg border px-3 py-2"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="Optional phone"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium">Notes</label>
              <textarea
                className="w-full rounded-lg border px-3 py-2"
                rows={4}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional notes"
              />
            </div>

            {saveError ? (
              <p className="text-sm font-medium text-red-600">{saveError}</p>
            ) : null}

            {saveMessage ? (
              <p className="text-sm font-medium text-green-600">{saveMessage}</p>
            ) : null}

            {savedOrderId ? (
              <p className="text-sm">
                <Link
                  href={`/orders/${savedOrderId}/edit`}
                  className="font-medium text-blue-600 underline"
                >
                  Open and view this submitted order
                </Link>
              </p>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSendToFactory}
                disabled={saving}
                className="rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {saving ? "Sending..." : "Send to Factory"}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                className="rounded-lg border px-4 py-2 hover:bg-slate-100"
              >
                Download PDF
              </button>
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