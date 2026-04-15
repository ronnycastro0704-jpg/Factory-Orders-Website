import { NextResponse } from "next/server";
import { prisma } from "../../../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
    groupId: string;
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
    const { groupId } = await context.params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const type = String(body.type || "SINGLE_SELECT").trim();
    const required = Boolean(body.required);
    const displayOrder = Number(body.displayOrder || 0);
    const active =
      typeof body.active === "boolean" ? body.active : true;

    if (!name) {
      return NextResponse.json(
        { error: "Group name is required." },
        { status: 400 }
      );
    }

    const group = await prisma.optionGroup.update({
      where: { id: groupId },
      data: {
        name,
        slug: slugify(name),
        type: type as "SINGLE_SELECT" | "MULTI_SELECT",
        required,
        displayOrder,
        active,
      },
    });

    return NextResponse.json(group);
  } catch (error) {
    console.error("UPDATE OPTION GROUP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update option group." },
      { status: 500 }
    );
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { groupId } = await context.params;

    await prisma.optionGroup.delete({
      where: { id: groupId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE OPTION GROUP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to delete option group." },
      { status: 500 }
    );
  }
}