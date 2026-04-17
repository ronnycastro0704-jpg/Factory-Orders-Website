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
    const appliesLeatherSurcharge =
      typeof body.appliesLeatherSurcharge === "boolean"
        ? body.appliesLeatherSurcharge
        : true;
    const allowsLaseredBrand = Boolean(body.allowsLaseredBrand);
    const isBinaryOption = Boolean(body.isBinaryOption);

    const gradeAUpcharge =
      body.gradeAUpcharge === "" || body.gradeAUpcharge === null || body.gradeAUpcharge === undefined
        ? null
        : Number(body.gradeAUpcharge);

    const gradeBUpcharge =
      body.gradeBUpcharge === "" || body.gradeBUpcharge === null || body.gradeBUpcharge === undefined
        ? null
        : Number(body.gradeBUpcharge);

    const gradeEMBUpcharge =
      body.gradeEMBUpcharge === "" || body.gradeEMBUpcharge === null || body.gradeEMBUpcharge === undefined
        ? null
        : Number(body.gradeEMBUpcharge);

    const gradeHOHUpcharge =
      body.gradeHOHUpcharge === "" || body.gradeHOHUpcharge === null || body.gradeHOHUpcharge === undefined
        ? null
        : Number(body.gradeHOHUpcharge);

    const gradeAxisUpcharge =
      body.gradeAxisUpcharge === "" || body.gradeAxisUpcharge === null || body.gradeAxisUpcharge === undefined
        ? null
        : Number(body.gradeAxisUpcharge);

    const gradeBuffaloUpcharge =
      body.gradeBuffaloUpcharge === "" || body.gradeBuffaloUpcharge === null || body.gradeBuffaloUpcharge === undefined
        ? null
        : Number(body.gradeBuffaloUpcharge);

    const comUpcharge =
      body.comUpcharge === "" || body.comUpcharge === null || body.comUpcharge === undefined
        ? null
        : Number(body.comUpcharge);

    if (!label) {
      return NextResponse.json(
        { error: "Choice label is required." },
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
        displayOrder,
        usesLeatherGrades,
        appliesLeatherSurcharge,
        allowsLaseredBrand,
        isBinaryOption,
        gradeAUpcharge,
        gradeBUpcharge,
        gradeEMBUpcharge,
        gradeHOHUpcharge,
        gradeAxisUpcharge,
        gradeBuffaloUpcharge,
        comUpcharge,
        active: true,
      },
    });

    return NextResponse.json(choice, { status: 201 });
  } catch (error) {
    console.error("CREATE OPTION CHOICE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create option choice." },
      { status: 500 }
    );
  }
}