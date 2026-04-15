"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatCurrency } from "../lib/utils";

type HomeProduct = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  imageUrl: string | null;
  basePrice: number;
};

type Props = {
  products: HomeProduct[];
};

export default function HomeProductGrid({ products }: Props) {
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(() => {
    const normalized = query.trim().toLowerCase();

    if (!normalized) return products;

    return products.filter((product: HomeProduct) => {
      const haystack = [
        product.name,
        product.description || "",
        product.slug,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalized);
    });
  }, [products, query]);

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-white p-4 shadow-sm">
        <label className="mb-2 block text-sm font-medium">Search Products</label>
        <input
          className="w-full rounded-lg border px-3 py-2"
          placeholder="Search barstool, chair, booth..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <p className="mt-2 text-sm text-slate-500">
          {filteredProducts.length} product
          {filteredProducts.length === 1 ? "" : "s"} found
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {filteredProducts.length === 0 ? (
          <div className="rounded-2xl border bg-white p-8 text-slate-500 shadow-sm">
            No products matched your search.
          </div>
        ) : (
          filteredProducts.map((product: HomeProduct) => (
            <Link
              key={product.id}
              href={`/products/${product.slug}`}
              className="overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="h-56 w-full object-cover"
                />
              ) : (
                <div className="flex h-56 w-full items-center justify-center bg-slate-100 text-sm text-slate-400">
                  No Product Image
                </div>
              )}

              <div className="p-6">
                <h2 className="text-2xl font-semibold">{product.name}</h2>
                <p className="mt-2 text-slate-600">
                  {product.description || "No description"}
                </p>
                <p className="mt-4 text-sm font-medium text-slate-500">
                  Starting at {formatCurrency(product.basePrice)}
                </p>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}