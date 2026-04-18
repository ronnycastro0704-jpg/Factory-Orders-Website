import Link from "next/link";
import { prisma } from "../lib/prisma";
import { formatCurrency } from "../lib/utils";

type PageProps = {
  searchParams?: Promise<{
    q?: string;
  }>;
};

type ProductCard = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  imageUrl: string | null;
  basePrice: unknown;
  optionGroups: {
    id: string;
  }[];
};

export default async function HomePage({ searchParams }: PageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const query = String(resolvedSearchParams?.q || "").trim();

  const products = (await prisma.product.findMany({
    where: {
      active: true,
      ...(query
        ? {
            OR: [
              {
                name: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                description: {
                  contains: query,
                  mode: "insensitive",
                },
              },
              {
                sku: {
                  contains: query,
                  mode: "insensitive",
                },
              },
            ],
          }
        : {}),
    },
    orderBy: {
      createdAt: "desc",
    },
    include: {
      optionGroups: {
        where: { active: true },
        select: { id: true },
      },
    },
  })) as ProductCard[];

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Custom Furniture Orders
              </p>

              <h1 className="text-4xl font-bold sm:text-5xl lg:text-6xl">
                Build clear, factory-ready furniture orders.
              </h1>

              <p className="mt-5 max-w-2xl text-base sm:text-lg text-slate-600">
                Choose a product, customize every section, select leather where
                needed, and send a clean order with visuals that are easier for
                the factory to understand.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/admin/products" className="button-primary">
                  Open Admin
                </Link>
                <Link href="/my/orders" className="button-secondary">
                  View My Orders
                </Link>
                <Link href="/admin/orders" className="button-secondary">
                  Admin Orders
                </Link>
              </div>
            </div>

            <div className="section-card-strong">
              <h2 className="text-2xl font-semibold">Find a Product</h2>
              <p className="mt-2 text-sm text-slate-500">
                Search by product name, description, or SKU.
              </p>

              <form method="GET" className="mt-5 flex flex-col gap-3 sm:flex-row">
                <input
                  type="text"
                  name="q"
                  defaultValue={query}
                  placeholder="Search products..."
                  className="field-input flex-1"
                />
                <button type="submit" className="button-primary">
                  Search
                </button>
              </form>

              {query ? (
                <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
                  <span className="status-pill">
                    {products.length} result{products.length === 1 ? "" : "s"} for &quot;{query}&quot;
                  </span>
                  <Link href="/" className="button-secondary">
                    Clear Search
                  </Link>
                </div>
              ) : (
                <div className="mt-4">
                  <span className="status-pill">
                    {products.length} active product{products.length === 1 ? "" : "s"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="section-card-strong">
          <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Choose a Product
              </p>
              <h2 className="mt-2 text-3xl font-bold">Available Products</h2>
            </div>

            <p className="text-sm text-slate-500">
              Start with the base product, then configure all the details.
            </p>
          </div>

          {products.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
              <p className="text-lg font-semibold text-slate-700">
                No products found.
              </p>
              <p className="mt-2 text-sm text-slate-500">
                Try a different search or add products from the admin panel.
              </p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {products.map((product: ProductCard) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  className="premium-grid-card group flex flex-col"
                >
                  <div className="image-frame">
                    {product.imageUrl ? (
                      <div className="flex h-64 items-center justify-center overflow-hidden rounded-xl bg-white p-3">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="h-full w-full object-contain"
                        />
                      </div>
                    ) : (
                      <div className="flex h-64 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                        No Product Image
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex flex-1 flex-col">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-2xl font-semibold">{product.name}</h3>
                        <p className="mt-2 text-sm text-slate-500">
                          SKU: {product.sku || "—"}
                        </p>
                      </div>

                      <span className="status-pill whitespace-nowrap">
                        {product.optionGroups.length} option
                        {product.optionGroups.length === 1 ? "" : "s"}
                      </span>
                    </div>

                    <p className="mt-4 flex-1 text-sm leading-6 text-slate-600">
                      {product.description || "No description available yet."}
                    </p>

                    <div className="mt-6 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500">
                          Starting at
                        </p>
                        <p className="mt-1 text-2xl font-bold text-slate-900">
                          {formatCurrency(Number(product.basePrice))}
                        </p>
                      </div>

                      <span className="button-primary">Configure</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}