import { NextResponse } from "next/server";
import { prisma } from "../../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    groupId: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const { groupId } = await context.params;
    const body = await request.json();

    const label = String(body.label || "").trim();
    const value = String(body.value || "").trim();
    const description = String(body.description || "").trim();
    const imageUrl = String(body.imageUrl || "").trim();
    const priceDelta = Number(body.priceDelta || 0);
    const displayOrder = Number(body.displayOrder || 0);

    const usesLeatherGrades = Boolean(body.usesLeatherGrades);

    const gradeAUpcharge =
      body.gradeAUpcharge === "" || body.gradeAUpcharge === undefined
        ? null
        : Number(body.gradeAUpcharge);

    const gradeBUpcharge =
      body.gradeBUpcharge === "" || body.gradeBUpcharge === undefined
        ? null
        : Number(body.gradeBUpcharge);

    const gradeEMBUpcharge =
      body.gradeEMBUpcharge === "" || body.gradeEMBUpcharge === undefined
        ? null
        : Number(body.gradeEMBUpcharge);

    const gradeHOHUpcharge =
      body.gradeHOHUpcharge === "" || body.gradeHOHUpcharge === undefined
        ? null
        : Number(body.gradeHOHUpcharge);

    const gradeAxisUpcharge =
      body.gradeAxisUpcharge === "" || body.gradeAxisUpcharge === undefined
        ? null
        : Number(body.gradeAxisUpcharge);

    const gradeBuffaloUpcharge =
      body.gradeBuffaloUpcharge === "" || body.gradeBuffaloUpcharge === undefined
        ? null
        : Number(body.gradeBuffaloUpcharge);

    const comUpcharge =
      body.comUpcharge === "" || body.comUpcharge === undefined
        ? null
        : Number(body.comUpcharge);

    if (!label) {
      return NextResponse.json(
        { error: "Choice label is required." },
        { status: 400 }
      );
    }

    if (Number.isNaN(priceDelta)) {
      return NextResponse.json(
        { error: "Price delta must be a valid number." },
        { status: 400 }
      );
    }

    const choice = await prisma.optionChoice.create({
      data: {
        optionGroupId: groupId,
        label,
        value: value || null,
        description: description || null,
        imageUrl: imageUrl || null,
        priceDelta,
        usesLeatherGrades,
        gradeAUpcharge,
        gradeBUpcharge,
        gradeEMBUpcharge,
        gradeHOHUpcharge,
        gradeAxisUpcharge,
        gradeBuffaloUpcharge,
        comUpcharge,
        displayOrder,
        active: true,
      },
    });

    return NextResponse.json(choice, { status: 201 });
  } catch (error) {
    console.error("CREATE OPTION CHOICE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create choice." },
      { status: 500 }
    );
  }
}