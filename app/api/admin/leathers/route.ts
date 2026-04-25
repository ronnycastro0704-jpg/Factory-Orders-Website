import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { slugify } from "../../../../lib/utils";

export async function GET() {
  try {
    const leathers = await prisma.leather.findMany({
      orderBy: { name: "asc" },
    });

    return NextResponse.json(leathers);
  } catch (error) {
    console.error("GET LEATHERS ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load leathers." },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const name = String(body.name || "").trim();
    const grade = String(body.grade || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const inventoryUnits = Number(body.inventoryUnits ?? 0);

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

    if (!Number.isFinite(inventoryUnits)) {
      return NextResponse.json(
        { error: "Leather inventory must be a valid number." },
        { status: 400 }
      );
    }

    const leather = await prisma.leather.create({
      data: {
        name,
        slug: slugify(name),
        grade,
        imageUrl: imageUrl || null,
        inventoryUnits,
        active: true,
      },
    });

    return NextResponse.json(leather, { status: 201 });
  } catch (error) {
    console.error("CREATE LEATHER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create leather." },
      { status: 500 }
    );
  }
}