import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../lib/prisma";
import CreateLeatherForm from "./leather-form";
import LeatherRowActions from "./leather-row-actions";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    stock?: string;
  }>;
};

type LeatherRow = {
  id: string;
  name: string;
  slug: string;
  grade: string;
  imageUrl: string | null;
  inventoryUnits: unknown;
  active: boolean;
};

function formatInventoryUnits(value: number) {
  return `${value.toFixed(2)} units`;
}

export default async function AdminLeathersPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const query = String(params.q || "").trim();
  const stockFilter = String(params.stock || "all").trim().toLowerCase();

const queryParts = query
  .toLowerCase()
  .split(/\s+/)
  .map((part) => part.trim())
  .filter(Boolean);

const searchFilter: Prisma.LeatherWhereInput =
  queryParts.length > 0
    ? {
        AND: queryParts.map((part) => ({
          OR: [
            { name: { contains: part, mode: "insensitive" } },
            { slug: { contains: part, mode: "insensitive" } },
            { grade: { contains: part, mode: "insensitive" } },
          ],
        })),
      }
    : {};

const where: Prisma.LeatherWhereInput = {
  ...searchFilter,
  ...(stockFilter === "negative"
    ? {
        inventoryUnits: {
          lt: 0,
        },
      }
    : {}),
  ...(stockFilter === "low"
    ? {
        inventoryUnits: {
          lt: 2,
        },
      }
    : {}),
};

  const [allLeathers, leathers] = await Promise.all([
    prisma.leather.findMany({
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
    prisma.leather.findMany({
      where,
      orderBy: [{ grade: "asc" }, { name: "asc" }],
    }),
  ]);

  const typedAllLeathers = allLeathers as LeatherRow[];
  const typedLeathers = leathers as LeatherRow[];

  const activeCount = typedAllLeathers.filter((leather) => leather.active).length;
  const lowStockCount = typedAllLeathers.filter(
    (leather) => Number(leather.inventoryUnits || 0) < 2
  ).length;
  const negativeCount = typedAllLeathers.filter(
    (leather) => Number(leather.inventoryUnits || 0) < 0
  ).length;
  const totalInventoryUnits = typedAllLeathers.reduce(
    (sum, leather) => sum + Number(leather.inventoryUnits || 0),
    0
  );

  const gradeCounts = typedLeathers.reduce<Record<string, number>>(
    (acc, leather) => {
      acc[leather.grade] = (acc[leather.grade] || 0) + 1;
      return acc;
    },
    {}
  );

  const gradeSummary = Object.entries(gradeCounts)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([grade, count]) => `${grade}: ${count}`)
    .join(" • ");

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Leathers
              </p>
              <h1 className="text-4xl font-bold sm:text-5xl">
                Manage your leather library
              </h1>
              <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
                Keep leather names, grades, images, and live inventory in one
                place so your client can see what is available before production.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/production" className="button-secondary">
                Production
              </Link>
              <Link href="/admin/orders" className="button-secondary">
                Orders
              </Link>
              <Link href="/admin/products" className="button-secondary">
                Products
              </Link>
            </div>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-4">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Leathers
            </p>
            <p className="mt-3 text-4xl font-bold">{typedAllLeathers.length}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Active
            </p>
            <p className="mt-3 text-4xl font-bold">{activeCount}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Low Stock
            </p>
            <p className="mt-3 text-4xl font-bold">{lowStockCount}</p>
            <p className="mt-2 text-xs text-slate-500">Less than 2 units</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Inventory
            </p>
            <p className="mt-3 text-4xl font-bold">
              {totalInventoryUnits.toFixed(2)}
            </p>
          </div>
        </section>

        <div className="mt-8 grid gap-8 lg:grid-cols-[420px_1fr]">
          <section className="section-card-strong">
            <h2 className="text-2xl font-semibold">Add Leather</h2>
            <p className="mt-2 text-sm text-slate-500">
              Create leather entries with a grade, image, and starting inventory.
            </p>

            <div className="mt-6">
              <CreateLeatherForm />
            </div>
          </section>

          <section className="section-card-strong">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                  Leather Library
                </p>
                <h2 className="mt-2 text-3xl font-bold">Existing Leathers</h2>
              </div>

              <span className="status-pill">
                {gradeSummary || "No grades yet"}
              </span>
            </div>

            <form className="mb-6 grid gap-3 lg:grid-cols-[1fr_220px_auto_auto]">
              <div>
                <label className="mb-1 block text-sm font-medium">Search</label>
                <input
                  name="q"
                  defaultValue={query}
                  placeholder="Search leather, grade, or slug..."
                  className="w-full rounded-lg border px-3 py-2"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">Stock</label>
                <select
                  name="stock"
                  defaultValue={stockFilter}
                  className="w-full rounded-lg border px-3 py-2"
                >
                  <option value="all">All Stock</option>
                  <option value="low">Low Stock (&lt; 2)</option>
                  <option value="negative">Negative Only</option>
                </select>
              </div>

              <div className="flex items-end">
                <button type="submit" className="button-primary w-full">
                  Search
                </button>
              </div>

              <div className="flex items-end">
                <Link href="/admin/leathers" className="button-secondary w-full">
                  Clear
                </Link>
              </div>
            </form>

            <div className="mb-6 flex flex-wrap gap-2">
              <span className="status-pill">
                Showing {typedLeathers.length} leather
                {typedLeathers.length === 1 ? "" : "s"}
              </span>
              <span className="status-pill">
                Negative: {negativeCount}
              </span>
              <span className="status-pill">
                Low Stock: {lowStockCount}
              </span>
            </div>

            {typedLeathers.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
                <p className="text-lg font-semibold text-slate-700">
                  No leathers matched your filters.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Try clearing the search or choosing a different stock filter.
                </p>
                <div className="mt-6">
                  <Link href="/admin/leathers" className="button-primary">
                    Clear Filters
                  </Link>
                </div>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {typedLeathers.map((leather: LeatherRow) => {
                  const inventoryUnits = Number(leather.inventoryUnits || 0);

                  return (
                    <div key={leather.id} className="premium-grid-card">
                      <div className="image-frame">
                        {leather.imageUrl ? (
                          <div className="flex h-56 items-center justify-center overflow-hidden rounded-xl bg-white p-3">
                            <img
                              src={leather.imageUrl}
                              alt={leather.name}
                              className="h-full w-full object-contain"
                            />
                          </div>
                        ) : (
                          <div className="flex h-56 items-center justify-center rounded-xl bg-slate-100 text-sm text-slate-400">
                            No Image
                          </div>
                        )}
                      </div>

                      <div className="mt-5">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <h3 className="text-xl font-semibold">
                              {leather.name}
                            </h3>
                            <p className="mt-1 text-sm text-slate-500">
                              Slug: {leather.slug}
                            </p>
                          </div>

                          <span className="status-pill">
                            {leather.active ? "Active" : "Inactive"}
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3">
                          <div className="soft-panel">
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Grade
                            </p>
                            <p className="mt-2 text-lg font-bold text-slate-900">
                              {leather.grade}
                            </p>
                          </div>

                          <div
                            className={`soft-panel ${
                              inventoryUnits < 0
                                ? "border-red-200 bg-red-50"
                                : inventoryUnits < 2
                                ? "border-amber-200 bg-amber-50"
                                : ""
                            }`}
                          >
                            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                              Inventory
                            </p>
                            <p
                              className={`mt-2 text-lg font-bold ${
                                inventoryUnits < 0
                                  ? "text-red-700"
                                  : inventoryUnits < 2
                                  ? "text-amber-700"
                                  : "text-slate-900"
                              }`}
                            >
                              {formatInventoryUnits(inventoryUnits)}
                            </p>
                          </div>
                        </div>

                        <LeatherRowActions
                          leather={{
                            id: leather.id,
                            name: leather.name,
                            grade: leather.grade,
                            imageUrl: leather.imageUrl,
                            inventoryUnits,
                            active: leather.active,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}