import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { slugify } from "../../../../lib/utils";

export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error("GET PRODUCTS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load products." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const sku = String(body.sku || "").trim();
    const basePrice = Number(body.basePrice || 0);

    if (!name) {
      return NextResponse.json(
        { error: "Product name is required." },
        { status: 400 }
      );
    }

    if (Number.isNaN(basePrice) || basePrice < 0) {
      return NextResponse.json(
        { error: "Base price must be a valid number." },
        { status: 400 }
      );
    }

    const slug = slugify(name);

    const existing = await prisma.product.findUnique({
      where: { slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: "A product with that name already exists." },
        { status: 400 }
      );
    }

    const product = await prisma.product.create({
      data: {
        name,
        slug,
        description: description || null,
        sku: sku || null,
        basePrice,
        active: true,
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error("CREATE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create product." },
      { status: 500 }
    );
  }
}