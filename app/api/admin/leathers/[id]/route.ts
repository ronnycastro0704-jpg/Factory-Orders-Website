import { NextResponse } from "next/server";
import { prisma } from "../../../../../lib/prisma";

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
    const grade = String(body.grade || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const active =
      typeof body.active === "boolean" ? body.active : true;

    if (!name) {
      return NextResponse.json(
        { error: "Leather name is required." },
        { status: 400 }
      );
    }

    if (!grade) {
      return NextResponse.json(
        { error: "Leather grade is required." },
        { status: 400 }
      );
    }

    const leather = await prisma.leather.update({
      where: { id },
      data: {
        name,
        slug: slugify(name),
        grade,
        imageUrl: imageUrl || null,
        active,
      },
    });

    return NextResponse.json(leather);
  } catch (error) {
    console.error("UPDATE LEATHER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update leather." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.leather.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE LEATHER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete leather." },
      { status: 500 }
    );
  }
}