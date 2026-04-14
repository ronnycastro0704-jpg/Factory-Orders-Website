import { prisma } from "../../../../lib/prisma";
import { formatCurrency } from "../../../../lib/utils";
import CreateOptionGroupForm from "./option-group-form";
import CreateOptionChoiceForm from "./option-choice-form";
import { notFound } from "next/navigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminProductDetailPage({ params }: PageProps) {
  const { id } = await params;

  const product = await prisma.product.findUnique({
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
  });

  if (!product) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="rounded-2xl border bg-white p-6 shadow-sm">
          <p className="text-sm text-slate-500">Admin Product</p>
          <h1 className="mt-2 text-3xl font-bold">{product.name}</h1>
          <p className="mt-2 text-slate-600">{product.description || "No description"}</p>
          <p className="mt-4 font-medium">
            Base Price: {formatCurrency(Number(product.basePrice))}
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="space-y-8">
            <div className="rounded-2xl border bg-white p-6 shadow-sm">
              <h2 className="text-2xl font-semibold">Add Option Group</h2>
              <p className="mt-2 text-sm text-slate-500">
                Example: Inside Back, Outside Back, Arms, Nails, Seat Leather.
              </p>

              <div className="mt-6">
                <CreateOptionGroupForm productId={product.id} />
              </div>
            </div>
          </div>

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
                product.optionGroups.map((group) => (
                  <div key={group.id} className="rounded-2xl border p-5">
                    <div className="mb-4">
                      <h3 className="text-xl font-semibold">{group.name}</h3>
                      <p className="text-sm text-slate-500">
                        {group.required ? "Required" : "Optional"} • {group.type}
                      </p>
                    </div>

                    <div className="mb-5 space-y-2">
                      {group.choices.length === 0 ? (
                        <p className="text-sm text-slate-500">No choices yet.</p>
                      ) : (
group.choices.map((choice) => (
  <div
    key={choice.id}
    className="rounded-lg border bg-slate-50 p-4"
  >
    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
      <div className="flex gap-4">
        {choice.imageUrl ? (
          <img
            src={choice.imageUrl}
            alt={choice.label}
            className="h-24 w-24 rounded-lg border object-cover"
          />
        ) : (
          <div className="flex h-24 w-24 items-center justify-center rounded-lg border bg-white text-xs text-slate-400">
            No Image
          </div>
        )}

        <div>
          <p className="font-medium">{choice.label}</p>
          <p className="text-sm text-slate-500">
            {choice.description || "No description"}
          </p>
        </div>
      </div>

      <div className="text-right">
        <p className="font-medium">
          {Number(choice.priceDelta) === 0
            ? "Included"
            : `+${formatCurrency(Number(choice.priceDelta))}`}
        </p>
      </div>
    </div>
  </div>
))
                      )}
                    </div>

                    <CreateOptionChoiceForm groupId={group.id} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}