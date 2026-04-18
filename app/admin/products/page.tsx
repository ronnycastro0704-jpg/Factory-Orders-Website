import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import { formatCurrency } from "../../../lib/utils";
import CreateProductForm from "./product-form";
import ProductRowActions from "./product-row-actions";

type ProductRow = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  basePrice: unknown;
  active: boolean;
  optionGroups: {
    id: string;
  }[];
};

export default async function AdminProductsPage() {
  const products = (await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      optionGroups: true,
    },
  })) as ProductRow[];

  const activeCount = products.filter((product) => product.active).length;
  const inactiveCount = products.length - activeCount;

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Products
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                Build and manage your catalog
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Add products, manage images, and open each product to organize
                groups and choices for the builder.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/orders" className="button-secondary">
                Orders
              </Link>
              <Link href="/admin/leathers" className="button-secondary">
                Leathers
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Products
            </p>
            <p className="mt-3 text-4xl font-bold">{products.length}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Active
            </p>
            <p className="mt-3 text-4xl font-bold">{activeCount}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Inactive
            </p>
            <p className="mt-3 text-4xl font-bold">{inactiveCount}</p>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="section-card-strong">
            <h2 className="text-2xl font-semibold">Create Product</h2>
            <p className="mt-2 text-sm text-slate-500">
              Add a new furniture product like a chair, barstool, booth, or sofa.
            </p>

            <div className="mt-6">
              <CreateProductForm />
            </div>
          </section>

          <section className="section-card-strong">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Product Catalog
                </p>
                <h2 className="mt-2 text-3xl font-bold">Existing Products</h2>
              </div>

              <span className="status-pill">
                {products.length} total
              </span>
            </div>

            {products.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
                <p className="text-lg font-semibold text-slate-700">
                  No products yet.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Create your first product using the form on the left.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 xl:grid-cols-2">
                {products.map((product: ProductRow) => (
                  <div key={product.id} className="premium-grid-card">
                    <div className="flex flex-col gap-5">
                      <div className="image-frame">
                        {product.imageUrl ? (
                          <div className="flex h-56 items-center justify-center overflow-hidden rounded-xl bg-white p-3">
                            <img
                              src={product.imageUrl}
                              alt={product.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-56 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="flex flex-col gap-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-2xl font-semibold">
                              {product.name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Slug: {product.slug}
                            </p>
                            <p className="text-sm text-slate-500">
                              SKU: {product.sku || "—"}
                            </p>
                          </div>

                          <span className="status-pill">
                            {product.active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <p className="text-sm leading-6 text-slate-600">
                          {product.description || "No description"}
                        </p>

                        <div className="grid gap-3 sm:grid-cols-2">
                          <div className="soft-panel">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Base Price
                            </p>
                            <p className="mt-2 text-xl font-bold text-slate-900">
                              {formatCurrency(Number(product.basePrice))}
                            </p>
                          </div>

                          <div className="soft-panel">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Option Groups
                            </p>
                            <p className="mt-2 text-xl font-bold text-slate-900">
                              {product.optionGroups.length}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <Link
                            href={`/products/${product.slug}`}
                            className="button-secondary"
                          >
                            View Builder
                          </Link>
                          <Link
                            href={`/admin/products/${product.id}`}
                            className="button-primary"
                          >
                            Manage Options
                          </Link>
                        </div>

                        <ProductRowActions
                          product={{
                            id: product.id,
                            name: product.name,
                            description: product.description,
                            sku: product.sku,
                            imageUrl: product.imageUrl,
                            basePrice: Number(product.basePrice),
                            active: product.active,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}