import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";
import CreateProductForm from "./product-form";

export default async function AdminProductsPage() {
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      optionGroups: true,
    },
  });

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm text-slate-500">Admin</p>
          <h1 className="text-4xl font-bold">Products</h1>
          <p className="mt-2 text-slate-600">
            Add furniture items your client can later configure in the builder.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Create Product</h2>
            <p className="mt-2 text-sm text-slate-500">
              Start by adding a furniture item like Barstool, Chair, Sofa, or
              Booth.
            </p>

            <div className="mt-6">
              <CreateProductForm />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Existing Products</h2>
              <span className="text-sm text-slate-500">
                {products.length} total
              </span>
            </div>

            <div className="space-y-4">
              {products.length === 0 ? (
                <p className="text-slate-500">No products yet.</p>
              ) : (
                products.map((product) => (
                  <div
                    key={product.id}
                    className="rounded-xl border p-4 transition hover:bg-slate-50"
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <h3 className="text-xl font-semibold">{product.name}</h3>
                        <p className="text-sm text-slate-500">
                          Slug: {product.slug}
                        </p>
                        <p className="mt-1 text-slate-600">
                          {product.description || "No description"}
                        </p>
                        <p className="mt-2 text-sm text-slate-500">
                          SKU: {product.sku || "—"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">
                          Option Groups: {product.optionGroups.length}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <p className="text-lg font-semibold">
                          {formatCurrency(Number(product.basePrice))}
                        </p>
                        <div className="mt-3 flex gap-2 md:justify-end">
                          <Link
                            href={`/products/${product.slug}`}
                            className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
                          >
                            View Builder
                          </Link>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
                          >
                            Manage Options
                          </Link>
                        </div>
                      </div>
                    </div>
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