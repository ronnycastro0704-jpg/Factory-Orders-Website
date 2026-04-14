import Link from "next/link";
import { prisma } from "../lib/prisma";
import { formatCurrency } from "../lib/utils";

export default async function HomePage() {
  const products = await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="min-h-screen bg-white p-8 text-slate-900">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-2 text-4xl font-bold">Furniture Builder</h1>
        <p className="mb-8 text-slate-600">
          Choose a furniture item to start building it.
        </p>

        <div className="grid gap-6 md:grid-cols-2">
          {products.map((product) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="rounded-2xl border p-6 shadow-sm transition hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold">{product.name}</h2>
              <p className="mt-2 text-slate-600">{product.description}</p>
              <p className="mt-4 font-medium">
                Base Price: {formatCurrency(Number(product.basePrice))}
              </p>
              <p className="mt-4 text-sm text-blue-600">Open Builder</p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}