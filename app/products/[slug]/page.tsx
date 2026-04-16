import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";
import ProductBuilder from "./product-builder";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
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
  allowsLaseredBrand: boolean;
};

type ProductGroup = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  displayOrder: number;
  active: boolean;
  choices: ProductChoice[];
};

type ProductRecord = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  active: boolean;
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

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;

  const product = (await prisma.product.findUnique({
    where: { slug },
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

  const serializedProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    sku: product.sku,
    active: product.active,
    basePrice: Number(product.basePrice),
    optionGroups: product.optionGroups.map((group: ProductGroup) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      type: group.type,
      required: group.required,
      displayOrder: group.displayOrder,
      active: group.active,
      choices: group.choices.map((choice: ProductChoice) => ({
        id: choice.id,
        label: choice.label,
        allowsLaseredBrand: choice.allowsLaseredBrand,
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
          choice.gradeHOHUpcharge === null
            ? null
            : Number(choice.gradeHOHUpcharge),
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
        displayOrder: choice.displayOrder,
        active: choice.active,
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
        <p className="mb-2 text-sm text-slate-500">Product Builder</p>

        <div className="grid gap-8 lg:grid-cols-[320px_1fr] lg:items-start">
          <div>
            {product.imageUrl ? (
              <img
                src={product.imageUrl}
                alt={product.name}
                className="w-full rounded-2xl border object-cover shadow-sm"
              />
            ) : (
              <div className="flex h-72 w-full items-center justify-center rounded-2xl border bg-slate-100 text-sm text-slate-400 shadow-sm">
                No Product Image
              </div>
            )}
          </div>

          <div>
            <h1 className="text-4xl font-bold">{product.name}</h1>
            <p className="mt-2 text-slate-600">{product.description}</p>
            <p className="mt-4 text-lg font-medium">
              Base Price: {formatCurrency(Number(product.basePrice))}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <ProductBuilder
            product={serializedProduct}
            leathers={serializedLeathers}
          />
        </div>
      </div>
    </main>
  );
}