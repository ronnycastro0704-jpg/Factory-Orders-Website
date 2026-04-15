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

type ProductChoice = {
  id: string;
  label: string;
  value: string | null;
  description: string | null;
  imageUrl: string | null;
  priceDelta: unknown;
  usesLeatherGrades: boolean;
  gradeAUpcharge: unknown | null;
  gradeBUpcharge: unknown | null;
  gradeEMBUpcharge: unknown | null;
  gradeHOHUpcharge: unknown | null;
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
};

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

  const initialSelectedOptions: Record<string, string> = {};
  const initialSelectedLeatherByGroupId: Record<string, string> = {};

  for (const group of product.optionGroups) {
    const savedChoiceSelection = item.selections.find(
      (selection: SavedSelection) =>
        selection.optionGroupNameSnapshot === group.name
    );

    if (savedChoiceSelection) {
      const matchedChoice = group.choices.find(
        (choice: ProductChoice) =>
          choice.label === savedChoiceSelection.optionChoiceNameSnapshot
      );

      if (matchedChoice) {
        initialSelectedOptions[group.id] = matchedChoice.id;
      }
    }

    const savedLeatherSelection = item.selections.find(
      (selection: SavedSelection) =>
        selection.optionGroupNameSnapshot === `${group.name} Leather`
    );

    if (savedLeatherSelection) {
      const leatherLabel = savedLeatherSelection.optionChoiceNameSnapshot.replace(
        /\s+\((.*?)\)$/,
        ""
      );

      const matchedLeather = leathers.find(
        (leather: LeatherRecord) => leather.name === leatherLabel
      );

      if (matchedLeather) {
        initialSelectedLeatherByGroupId[group.id] = matchedLeather.id;
      }
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
      required: group.required,
      choices: group.choices.map((choice: ProductChoice) => ({
        id: choice.id,
        label: choice.label,
        value: choice.value,
        description: choice.description,
        imageUrl: choice.imageUrl,
        priceDelta: Number(choice.priceDelta),
        usesLeatherGrades: choice.usesLeatherGrades,
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
            initialSelectedLeatherByGroupId={initialSelectedLeatherByGroupId}
            initialCustomerName={order.customerName}
            initialCustomerEmail={order.customerEmail}
            initialCustomerPhone={order.customerPhone || ""}
            initialNotes={order.notes || ""}
          />
        </div>
      </div>
    </main>
  );
}