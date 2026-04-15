import { prisma } from "../lib/prisma";
import HomeProductGrid from "./home-product-grid";

type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: unknown;
};

export default async function HomePage() {
  const productsRaw = (await prisma.product.findMany({
    where: { active: true },
    orderBy: { createdAt: "desc" },
  })) as HomeProduct[];

  const products = productsRaw.map((product: HomeProduct) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    description: product.description,
    imageUrl: product.imageUrl,
    basePrice: Number(product.basePrice),
  }));

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

        <HomeProductGrid products={products} />
      </div>
    </main>
  );
}