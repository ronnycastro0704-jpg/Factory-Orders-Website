import { notFound } from "next/navigation";
import { prisma } from "../../../../lib/prisma";
import CustomerOrderEditBuilder from "./customer-order-edit-builder";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type SavedSelection = {
  id: string;
  optionGroupNameSnapshot: string;
  optionChoiceNameSnapshot: string;
  priceDeltaSnapshot: unknown;
};

type SavedOrderItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  basePriceSnapshot: unknown;
  lineTotal: unknown;
  selections: SavedSelection[];
};

type SavedRevision = {
  id: string;
  afterJson: unknown;
};

type ProductChoice = {
  id: string;
  label: string;
  value: string | null;
  description: string | null;
  imageUrl: string | null;
  priceDelta: unknown;
  usesLeatherGrades: boolean;
  appliesLeatherSurcharge: boolean;
  allowsLaseredBrand: boolean;
  isBinaryOption: boolean;
  isQuickPick: boolean;
  isBodyLeather: boolean;
  frameNeededCode: string | null;
  gradeAUpcharge: unknown | null;
  gradeBUpcharge: unknown | null;
  gradeEMBUpcharge: unknown | null;
  gradeHOHUpcharge: unknown | null;
  leatherInventoryUsage: unknown | null;
  gradeAxisUpcharge: unknown | null;
  gradeBuffaloUpcharge: unknown | null;
  comUpcharge: unknown | null;
  displayOrder: number;
  active: boolean;
};

type ProductGroup = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  choices: ProductChoice[];
};

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  basePrice: unknown;
  optionGroups: ProductGroup[];
};

type LeatherRecord = {
  id: string;
  name: string;
  slug: string;
  grade: string;
  imageUrl: string | null;
  inventoryUnits: unknown;
};

const SELECTION_META_SEPARATOR = "|||";

function makeSelectionKey(groupId: string, choiceId: string) {
  return `${groupId}:::${choiceId}`;
}

function parseScopedValue(raw: string) {
  const index = raw.indexOf(SELECTION_META_SEPARATOR);

  if (index === -1) {
    return {
      choiceLabel: null,
      value: raw,
    };
  }

  return {
    choiceLabel: raw.slice(0, index),
    value: raw.slice(index + SELECTION_META_SEPARATOR.length),
  };
}

function sanitizeQuantity(value: unknown) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function extractRevisionQuantity(afterJson: unknown) {
  if (!afterJson || typeof afterJson !== "object") {
    return 1;
  }

  const parsed = afterJson as {
    quantity?: unknown;
    selections?: unknown;
  };

  if (parsed.quantity !== undefined) {
    return sanitizeQuantity(parsed.quantity);
  }

  if (Array.isArray(parsed.selections) && parsed.selections.length > 0) {
    const first = parsed.selections[0];

    if (first && typeof first === "object" && "quantity" in first) {
      return sanitizeQuantity((first as { quantity?: unknown }).quantity);
    }
  }

  return 1;
}

export default async function CustomerOrderEditPage({ params }: PageProps) {
  const { id } = await params;

  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          selections: true,
        },
      },
      revisions: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
  });

  if (!order) {
    notFound();
  }

  const item = order.items[0] as SavedOrderItem | undefined;

  if (!item) {
    notFound();
  }

  const product = (await prisma.product.findUnique({
    where: { id: item.productId },
    include: {
      optionGroups: {
        where: { active: true },
        orderBy: { displayOrder: "asc" },
        include: {
          choices: {
            where: { active: true },
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
  })) as ProductRecord | null;

  if (!product) {
    notFound();
  }

  const leathers = (await prisma.leather.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  })) as LeatherRecord[];

  const latestRevision = order.revisions[0] as SavedRevision | undefined;
  const initialQuantity = extractRevisionQuantity(latestRevision?.afterJson);

  const initialSelectedOptions: Record<string, string[]> = {};
  const initialSelectedLeatherBySelectionKey: Record<string, string> = {};
  const initialSelectedLaseredBrandBySelectionKey: Record<string, "yes" | "no"> =
    {};
  const initialSelectedLaseredBrandImageUrlBySelectionKey: Record<
    string,
    string
  > = {};

  const baseSelections = item.selections.filter(
    (selection: SavedSelection) =>
      !selection.optionGroupNameSnapshot.endsWith(" Leather") &&
      !selection.optionGroupNameSnapshot.endsWith(" Lasered Brand") &&
      !selection.optionGroupNameSnapshot.endsWith(" Lasered Brand Image")
  );

  for (const baseSelection of baseSelections) {
    const group = product.optionGroups.find(
      (groupItem: ProductGroup) =>
        groupItem.name === baseSelection.optionGroupNameSnapshot
    );

    if (!group) continue;

    let matchedChoice =
      group.choices.find(
        (choice: ProductChoice) =>
          choice.label === baseSelection.optionChoiceNameSnapshot
      ) || null;

    if (!matchedChoice) {
      const binaryChoice = group.choices.find(
        (choice: ProductChoice) => choice.isBinaryOption
      );

      if (binaryChoice && baseSelection.optionChoiceNameSnapshot === "Yes") {
        matchedChoice = binaryChoice;
      }
    }

    if (!matchedChoice) continue;

    if (!initialSelectedOptions[group.id]) {
      initialSelectedOptions[group.id] = [];
    }

    if (!initialSelectedOptions[group.id].includes(matchedChoice.id)) {
      initialSelectedOptions[group.id].push(matchedChoice.id);
    }

    const selectionKey = makeSelectionKey(group.id, matchedChoice.id);

    const sameGroupBaseCount = baseSelections.filter(
      (selection: SavedSelection) =>
        selection.optionGroupNameSnapshot === group.name
    ).length;

    const leatherCandidates = item.selections.filter(
      (selection: SavedSelection) =>
        selection.optionGroupNameSnapshot === `${group.name} Leather`
    );

    const laseredBrandCandidates = item.selections.filter(
      (selection: SavedSelection) =>
        selection.optionGroupNameSnapshot === `${group.name} Lasered Brand`
    );

    const laseredBrandImageCandidates = item.selections.filter(
      (selection: SavedSelection) =>
        selection.optionGroupNameSnapshot === `${group.name} Lasered Brand Image`
    );

    const matchingLeather =
      leatherCandidates.find((selection: SavedSelection) => {
        const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
        return parsed.choiceLabel === matchedChoice.label;
      }) ??
      (sameGroupBaseCount === 1
        ? leatherCandidates.find((selection: SavedSelection) => {
            const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
            return parsed.choiceLabel === null;
          })
        : undefined);

    if (matchingLeather) {
      const parsedLeather = parseScopedValue(
        matchingLeather.optionChoiceNameSnapshot
      ).value;

      const leatherName = parsedLeather.replace(/\s+\((.*?)\)$/, "");

      const matchedLeather = leathers.find(
        (leather: LeatherRecord) => leather.name === leatherName
      );

      if (matchedLeather) {
        initialSelectedLeatherBySelectionKey[selectionKey] = matchedLeather.id;
      }
    }

    const matchingLaseredBrand =
      laseredBrandCandidates.find((selection: SavedSelection) => {
        const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
        return parsed.choiceLabel === matchedChoice.label;
      }) ??
      (sameGroupBaseCount === 1
        ? laseredBrandCandidates.find((selection: SavedSelection) => {
            const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
            return parsed.choiceLabel === null;
          })
        : undefined);

    if (
      matchingLaseredBrand &&
      parseScopedValue(matchingLaseredBrand.optionChoiceNameSnapshot).value ===
        "Yes"
    ) {
      initialSelectedLaseredBrandBySelectionKey[selectionKey] = "yes";
    }

    const matchingLaseredBrandImage =
      laseredBrandImageCandidates.find((selection: SavedSelection) => {
        const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
        return parsed.choiceLabel === matchedChoice.label;
      }) ??
      (sameGroupBaseCount === 1
        ? laseredBrandImageCandidates.find((selection: SavedSelection) => {
            const parsed = parseScopedValue(selection.optionChoiceNameSnapshot);
            return parsed.choiceLabel === null;
          })
        : undefined);

    if (matchingLaseredBrandImage) {
      initialSelectedLaseredBrandImageUrlBySelectionKey[selectionKey] =
        parseScopedValue(matchingLaseredBrandImage.optionChoiceNameSnapshot).value;
    }
  }

  const serializedProduct = {
    id: product.id,
    name: product.name,
    basePrice: Number(product.basePrice),
    optionGroups: product.optionGroups.map((group: ProductGroup) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      type: group.type,
      required: group.required,
choices: group.choices.map((choice: ProductChoice) => ({
  id: choice.id,
  label: choice.label,
  value: choice.value,
  description: choice.description,
  imageUrl: choice.imageUrl,
  priceDelta: Number(choice.priceDelta),
  leatherInventoryUsage:
    choice.leatherInventoryUsage === null
      ? null
      : Number(choice.leatherInventoryUsage),

  usesLeatherGrades: choice.usesLeatherGrades,
        appliesLeatherSurcharge: choice.appliesLeatherSurcharge,
        allowsLaseredBrand: choice.allowsLaseredBrand,
        isBinaryOption: choice.isBinaryOption,
        isQuickPick: choice.isQuickPick,
        isBodyLeather: choice.isBodyLeather,
        frameNeededCode: choice.frameNeededCode,
        gradeAUpcharge:
          choice.gradeAUpcharge === null ? null : Number(choice.gradeAUpcharge),
        gradeBUpcharge:
          choice.gradeBUpcharge === null ? null : Number(choice.gradeBUpcharge),
        gradeEMBUpcharge:
          choice.gradeEMBUpcharge === null
            ? null
            : Number(choice.gradeEMBUpcharge),
        gradeHOHUpcharge:
          choice.gradeHOHUpcharge === null ? null : Number(choice.gradeHOHUpcharge),
        gradeAxisUpcharge:
          choice.gradeAxisUpcharge === null
            ? null
            : Number(choice.gradeAxisUpcharge),
        gradeBuffaloUpcharge:
          choice.gradeBuffaloUpcharge === null
            ? null
            : Number(choice.gradeBuffaloUpcharge),
        comUpcharge:
          choice.comUpcharge === null ? null : Number(choice.comUpcharge),
      })),
    })),
  };

const serializedLeathers = leathers.map((leather: LeatherRecord) => ({
  id: leather.id,
  name: leather.name,
  slug: leather.slug,
  grade: leather.grade,
  imageUrl: leather.imageUrl,
  inventoryUnits: Number(leather.inventoryUnits || 0),
}));

  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <p className="mb-2 text-sm text-slate-500">Edit Order</p>
        <h1 className="text-4xl font-bold">{order.orderNumber}</h1>
        <p className="mt-2 text-slate-600">
          Update your selection and save changes.
        </p>

        <div className="mt-8">
          <CustomerOrderEditBuilder
            orderId={order.id}
            orderNumber={order.orderNumber}
            product={serializedProduct}
            leathers={serializedLeathers}
            initialSelectedOptions={initialSelectedOptions}
            initialSelectedLeatherBySelectionKey={
              initialSelectedLeatherBySelectionKey
            }
            initialSelectedLaseredBrandBySelectionKey={
              initialSelectedLaseredBrandBySelectionKey
            }
            initialSelectedLaseredBrandImageUrlBySelectionKey={
              initialSelectedLaseredBrandImageUrlBySelectionKey
            }
            initialCustomerName={order.customerName}
            initialCustomerEmail={order.customerEmail}
            initialCustomerPhone={order.customerPhone || ""}
            initialNotes={order.notes || ""}
            initialPoNumber={order.poNumber || ""}
            initialQuantity={initialQuantity}
          />
        </div>
      </div>
    </main>
  );
}