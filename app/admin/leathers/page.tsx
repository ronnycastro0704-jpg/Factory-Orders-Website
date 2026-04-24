import Link from "next/link";
import { prisma } from "../../../lib/prisma";
import CreateLeatherForm from "./leather-form";
import LeatherRowActions from "./leather-row-actions";

type LeatherRow = {
  id: string;
  name: string;
  slug: string;
  grade: string;
  imageUrl: string | null;
  active: boolean;
};

export default async function AdminLeathersPage() {
  const leathers = (await prisma.leather.findMany({
    orderBy: [{ grade: "asc" }, { name: "asc" }],
  })) as LeatherRow[];

  const activeCount = leathers.filter((leather) => leather.active).length;
  const inactiveCount = leathers.length - activeCount;

  const gradeCounts = leathers.reduce<Record<string, number>>((acc, leather) => {
    acc[leather.grade] = (acc[leather.grade] || 0) + 1;
    return acc;
  }, {});

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
                Keep leather names, grades, and reference images clean so customers
                and factory workers can identify materials more easily.
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

        <section className="grid gap-6 md:grid-cols-3">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Leathers
            </p>
            <p className="mt-3 text-4xl font-bold">{leathers.length}</p>
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
            <h2 className="text-2xl font-semibold">Add Leather</h2>
            <p className="mt-2 text-sm text-slate-500">
              Create leather entries with a grade and an image for visual clarity.
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

            {leathers.length === 0 ? (
              <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center">
                <p className="text-lg font-semibold text-slate-700">
                  No leathers yet.
                </p>
                <p className="mt-2 text-sm text-slate-500">
                  Add your first leather using the form on the left.
                </p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {leathers.map((leather: LeatherRow) => (
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
                          <h3 className="text-xl font-semibold">{leather.name}</h3>
                          <p className="mt-1 text-sm text-slate-500">
                            Slug: {leather.slug}
                          </p>
                        </div>

                        <span className="status-pill">
                          {leather.active ? "Active" : "Inactive"}
                        </span>
                      </div>

                      <div className="mt-4 soft-panel">
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
                          Grade
                        </p>
                        <p className="mt-2 text-lg font-bold text-slate-900">
                          {leather.grade}
                        </p>
                      </div>

                      <LeatherRowActions
                        leather={{
                          id: leather.id,
                          name: leather.name,
                          grade: leather.grade,
                          imageUrl: leather.imageUrl,
                          active: leather.active,
                        }}
                      />
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