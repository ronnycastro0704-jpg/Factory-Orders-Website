import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";
import { slugify } from "../../../../../../lib/utils";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const required = Boolean(body.required);
    const type =
      body.type === "MULTI_SELECT" ? "MULTI_SELECT" : "SINGLE_SELECT";
    const displayOrder = Number(body.displayOrder || 0);

    if (!name) {
      return NextResponse.json(
        { error: "Option group name is required." },
        { status: 400 }
      );
    }

    const slug = slugify(name);

    const existing = await prisma.optionGroup.findFirst({
      where: {
        productId: id,
        slug,
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An option group with that name already exists for this product." },
        { status: 400 }
      );
    }

    const optionGroup = await prisma.optionGroup.create({
      data: {
        productId: id,
        name,
        slug,
        required,
        type,
        displayOrder,
        active: true,
      },
    });

    return NextResponse.json(optionGroup, { status: 201 });
  } catch (error) {
    console.error("CREATE OPTION GROUP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create option group." },
      { status: 500 }
    );
  }
}