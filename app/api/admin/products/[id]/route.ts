import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

type TransactionClient = Omit<
  typeof prisma,
  "$connect" | "$disconnect" | "$on" | "$use" | "$extends"
>;

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const description = String(body.description || "").trim();
    const sku = String(body.sku || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const active =
      typeof body.active === "boolean" ? body.active : true;
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

    const existing = await prisma.product.findFirst({
      where: {
        slug,
        NOT: {
          id,
        },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Another product already uses that name/slug." },
        { status: 400 }
      );
    }

    const product = await prisma.product.update({
      where: { id },
      data: {
        name,
        slug,
        description: description || null,
        sku: sku || null,
        imageUrl: imageUrl || null,
        active,
        basePrice,
      },
    });

    return NextResponse.json(product);
  } catch (error) {
    console.error("UPDATE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update product." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const orderItemCount = await prisma.orderItem.count({
      where: { productId: id },
    });

    if (orderItemCount > 0) {
      return NextResponse.json(
        {
          error:
            "This product already has orders and cannot be deleted. Set it inactive instead.",
        },
        { status: 400 }
      );
    }

    await prisma.$transaction(async (tx: TransactionClient) => {
      const groups = await tx.optionGroup.findMany({
        where: { productId: id },
        select: { id: true },
      });

      const groupIds = groups.map((group: { id: string }) => group.id);

      if (groupIds.length > 0) {
        await tx.optionChoice.deleteMany({
          where: {
            optionGroupId: {
              in: groupIds,
            },
          },
        });
      }

      await tx.optionGroup.deleteMany({
        where: { productId: id },
      });

      await tx.product.delete({
        where: { id },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE PRODUCT ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete product." },
      { status: 500 }
    );
  }
}