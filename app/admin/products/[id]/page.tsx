import { prisma } from "../../../../lib/prisma";
import { notFound } from "next/navigation";
import CreateOptionGroupForm from "./option-group-form";
import CreateOptionChoiceForm from "./option-choice-form";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type OptionChoiceItem = {
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

type OptionGroupItem = {
  id: string;
  name: string;
  slug: string;
  type: string;
  required: boolean;
  displayOrder: number;
  active: boolean;
  choices: OptionChoiceItem[];
};

type ProductWithGroups = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  basePrice: unknown;
  optionGroups: OptionGroupItem[];
};

function money(value: unknown) {
  return Number(value).toFixed(2);
}

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  const product = (await prisma.product.findUnique({
    where: { id },
    include: {
      optionGroups: {
        orderBy: { displayOrder: "asc" },
        include: {
          choices: {
            orderBy: { displayOrder: "asc" },
          },
        },
      },
    },
  })) as ProductWithGroups | null;

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Admin Product</p>
          <h1 className="mt-2 text-4xl font-bold">{product.name}</h1>
          <p className="mt-2 text-slate-600">
            {product.description || "No description"}
          </p>
          <div className="mt-4 flex flex-wrap gap-6 text-sm text-slate-500">
            <span>Slug: {product.slug}</span>
            <span>SKU: {product.sku || "—"}</span>
            <span>Base Price: ${money(product.basePrice)}</span>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Create Option Group</h2>
            <p className="mt-2 text-sm text-slate-500">
              Add configurable sections like inside back, outside back, arms,
              nails, or seat.
            </p>

            <div className="mt-6">
              <CreateOptionGroupForm productId={product.id} />
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold">Option Groups</h2>
                <span className="text-sm text-slate-500">
                  {product.optionGroups.length} total
                </span>
              </div>

              <div className="space-y-6">
                {product.optionGroups.length === 0 ? (
                  <p className="text-slate-500">No option groups yet.</p>
                ) : (
                  product.optionGroups.map((group: OptionGroupItem) => (
                    <div key={group.id} className="rounded-2xl border p-5">
                      <div className="mb-4">
                        <h3 className="text-xl font-semibold">{group.name}</h3>
                        <p className="mt-1 text-sm text-slate-500">
                          Slug: {group.slug}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Type: {group.type} •{" "}
                          {group.required ? "Required" : "Optional"} • Order:{" "}
                          {group.displayOrder}
                        </p>
                      </div>

                      <div className="mb-5">
                        <CreateOptionChoiceForm groupId={group.id} />
                      </div>

                      <div className="space-y-3">
                        {group.choices.length === 0 ? (
                          <p className="text-sm text-slate-500">
                            No choices yet for this group.
                          </p>
                        ) : (
                          group.choices.map((choice: OptionChoiceItem) => (
                            <div
                              key={choice.id}
                              className="rounded-xl border bg-slate-50 p-4"
                            >
                              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                                <div className="flex-1">
                                  <p className="font-semibold">{choice.label}</p>
                                  <p className="text-sm text-slate-500">
                                    Value: {choice.value || "—"}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-600">
                                    {choice.description || "No description"}
                                  </p>
                                  <p className="mt-1 text-sm text-slate-500">
                                    Display Order: {choice.displayOrder}
                                  </p>

                                  {choice.usesLeatherGrades ? (
                                    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 text-sm text-slate-600">
                                      <p>Grade A: ${money(choice.gradeAUpcharge ?? 0)}</p>
                                      <p>Grade B: ${money(choice.gradeBUpcharge ?? 0)}</p>
                                      <p>Grade EMB: ${money(choice.gradeEMBUpcharge ?? 0)}</p>
                                      <p>Grade HOH: ${money(choice.gradeHOHUpcharge ?? 0)}</p>
                                      <p>Grade Axis: ${money(choice.gradeAxisUpcharge ?? 0)}</p>
                                      <p>Grade Buffalo: ${money(choice.gradeBuffaloUpcharge ?? 0)}</p>
                                      <p>COM: ${money(choice.comUpcharge ?? 0)}</p>
                                    </div>
                                  ) : null}
                                </div>

                                <div className="md:text-right">
                                  <p className="text-sm font-medium text-slate-700">
                                    Base Add-On: ${money(choice.priceDelta)}
                                  </p>
                                  {choice.imageUrl ? (
                                    <img
                                      src={choice.imageUrl}
                                      alt={choice.label}
                                      className="mt-3 h-24 w-24 rounded-lg object-cover md:ml-auto"
                                    />
                                  ) : (
                                    <div className="mt-3 flex h-24 w-24 items-center justify-center rounded-lg bg-white text-xs text-slate-400 md:ml-auto">
                                      No Image
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}