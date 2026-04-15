import Link from "next/link";
import { prisma } from "../lib/prisma";
import { formatCurrency } from "../lib/utils";

type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  basePrice: unknown;
};

export default async function HomePage() {
  const products = (await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  })) as HomeProduct[];

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm text-slate-500">Furniture Orders</p>
          <h1 className="text-4xl font-bold">Choose a Product</h1>
          <p className="mt-2 text-slate-600">
            Start a custom furniture order by selecting one of the available products.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          {products.map((product: HomeProduct) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="rounded-2xl border bg-white p-6 shadow-sm transition hover:bg-slate-50"
            >
              <h2 className="text-2xl font-semibold">{product.name}</h2>
              <p className="mt-2 text-slate-600">
                {product.description || "No description"}
              </p>
              <p className="mt-4 text-sm font-medium text-slate-500">
                Starting at {formatCurrency(Number(product.basePrice))}
              </p>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}