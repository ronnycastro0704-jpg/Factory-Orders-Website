import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";
import ProductBuilder from "./product-builder";

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
  appliesLeatherSurcharge: boolean;
  allowsLaseredBrand: boolean;
  isBinaryOption: boolean;
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

  if (!product || !product.active) {
    notFound();
  }

  const leathers = (await prisma.leather.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  })) as LeatherRecord[];

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
        usesLeatherGrades: choice.usesLeatherGrades,
        appliesLeatherSurcharge: choice.appliesLeatherSurcharge,
        allowsLaseredBrand: choice.allowsLaseredBrand,
        isBinaryOption: choice.isBinaryOption,
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
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
            <Link href="/" className="button-secondary">
              ← Back to Products
            </Link>
            <span className="status-pill">SKU: {product.sku || "—"}</span>
            <span className="status-pill">
              {product.optionGroups.length} option group
              {product.optionGroups.length === 1 ? "" : "s"}
            </span>
            <span className="status-pill">
              {leathers.length} leather
              {leathers.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
            <div className="section-card">
              <div className="image-frame">
                {product.imageUrl ? (
                  <div className="flex h-[340px] items-center justify-center overflow-hidden rounded-2xl bg-white p-4">
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      className="h-full w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-[340px] items-center justify-center rounded-2xl bg-slate-100 text-sm text-slate-400">
                    No Product Image
                  </div>
                )}
              </div>
            </div>

            <div>
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-slate-500">
                Configure Product
              </p>
              <h1 className="mt-3 text-4xl font-bold sm:text-5xl">
                {product.name}
              </h1>

              <p className="mt-5 max-w-2xl text-base sm:text-lg text-slate-600">
                {product.description ||
                  "Customize this product section by section, choose leather where needed, and generate a clean factory-ready order."}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="soft-panel">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Base Price
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {formatCurrency(Number(product.basePrice))}
                  </p>
                </div>

                <div className="soft-panel">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Option Groups
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {product.optionGroups.length}
                  </p>
                </div>

                <div className="soft-panel">
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                    Leather Library
                  </p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {leathers.length}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="section-card-strong">
          <div className="mb-6">
            <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
              Builder
            </p>
            <h2 className="mt-2 text-3xl font-bold">Customize Your Order</h2>
            <p className="mt-2 text-sm text-slate-500">
              Select the options you want, assign leather where needed, and send
              the final order to the factory.
            </p>
          </div>

          <ProductBuilder
            product={serializedProduct}
            leathers={serializedLeathers}
          />
        </section>
      </div>
    </main>
  );
}