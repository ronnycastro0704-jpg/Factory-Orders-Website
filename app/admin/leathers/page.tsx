import { prisma } from "../../../lib/prisma";
import CreateLeatherForm from "./leather-form";

type LeatherItem = {
  id: string;
  name: string;
  slug: string;
  grade: string;
  imageUrl: string | null;
};

export default async function AdminLeathersPage() {
  const leathers = (await prisma.leather.findMany({
    orderBy: { name: "asc" },
  })) as LeatherItem[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <div>
          <p className="text-sm text-slate-500">Admin</p>
          <h1 className="text-4xl font-bold">Leather Library</h1>
          <p className="mt-2 text-slate-600">
            Manage customer-facing leather names and their hidden pricing grades.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-[420px_1fr]">
          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <h2 className="text-2xl font-semibold">Add Leather</h2>
            <p className="mt-2 text-sm text-slate-500">
              Example: Mustang, Dakota Black, Brompton Tan.
            </p>

            <div className="mt-6">
              <CreateLeatherForm />
            </div>
          </div>

          <div className="rounded-2xl border bg-white p-6 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Existing Leathers</h2>
              <span className="text-sm text-slate-500">
                {leathers.length} total
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {leathers.length === 0 ? (
                <p className="text-slate-500">No leathers yet.</p>
              ) : (
                leathers.map((leather: LeatherItem) => (
                  <div
                    key={leather.id}
                    className="rounded-xl border bg-slate-50 p-4"
                  >
                    {leather.imageUrl ? (
                      <img
                        src={leather.imageUrl}
                        alt={leather.name}
                        className="mb-3 h-32 w-full rounded-lg object-cover"
                      />
                    ) : (
                      <div className="mb-3 flex h-32 w-full items-center justify-center rounded-lg bg-white text-sm text-slate-400">
                        No Image
                      </div>
                    )}

                    <p className="font-semibold">{leather.name}</p>
                    <p className="text-sm text-slate-500">{leather.grade}</p>
                    <p className="mt-1 text-xs text-slate-400">{leather.slug}</p>
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