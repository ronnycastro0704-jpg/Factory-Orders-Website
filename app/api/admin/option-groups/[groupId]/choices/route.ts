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
    const frameNeededCode = String(body.frameNeededCode || "").trim();

    const usesLeatherGrades = Boolean(body.usesLeatherGrades);
    const appliesLeatherSurcharge =
      typeof body.appliesLeatherSurcharge === "boolean"
        ? body.appliesLeatherSurcharge
        : true;
    const allowsLaseredBrand = Boolean(body.allowsLaseredBrand);
    const isBinaryOption = Boolean(body.isBinaryOption);
    const isQuickPick = Boolean(body.isQuickPick);
    const isBodyLeather = Boolean(body.isBodyLeather);

    const leatherInventoryUsage =
      body.leatherInventoryUsage === "" ||
      body.leatherInventoryUsage === null ||
      body.leatherInventoryUsage === undefined
        ? null
        : Number(body.leatherInventoryUsage);

    const gradeAUpcharge =
      body.gradeAUpcharge === "" ||
      body.gradeAUpcharge === null ||
      body.gradeAUpcharge === undefined
        ? null
        : Number(body.gradeAUpcharge);

    const gradeBUpcharge =
      body.gradeBUpcharge === "" ||
      body.gradeBUpcharge === null ||
      body.gradeBUpcharge === undefined
        ? null
        : Number(body.gradeBUpcharge);

    const gradeEMBUpcharge =
      body.gradeEMBUpcharge === "" ||
      body.gradeEMBUpcharge === null ||
      body.gradeEMBUpcharge === undefined
        ? null
        : Number(body.gradeEMBUpcharge);

    const gradeHOHUpcharge =
      body.gradeHOHUpcharge === "" ||
      body.gradeHOHUpcharge === null ||
      body.gradeHOHUpcharge === undefined
        ? null
        : Number(body.gradeHOHUpcharge);

    const gradeAxisUpcharge =
      body.gradeAxisUpcharge === "" ||
      body.gradeAxisUpcharge === null ||
      body.gradeAxisUpcharge === undefined
        ? null
        : Number(body.gradeAxisUpcharge);

    const gradeBuffaloUpcharge =
      body.gradeBuffaloUpcharge === "" ||
      body.gradeBuffaloUpcharge === null ||
      body.gradeBuffaloUpcharge === undefined
        ? null
        : Number(body.gradeBuffaloUpcharge);

    const comUpcharge =
      body.comUpcharge === "" ||
      body.comUpcharge === null ||
      body.comUpcharge === undefined
        ? null
        : Number(body.comUpcharge);

    if (!label) {
      return NextResponse.json(
        { error: "Choice label is required." },
        { status: 400 }
      );
    }

    if (!Number.isFinite(priceDelta)) {
      return NextResponse.json(
        { error: "Base price delta must be a valid number." },
        { status: 400 }
      );
    }

    if (
      leatherInventoryUsage !== null &&
      (!Number.isFinite(leatherInventoryUsage) || leatherInventoryUsage < 0)
    ) {
      return NextResponse.json(
        { error: "Leather usage must be 0 or greater." },
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
        frameNeededCode: frameNeededCode || null,
        usesLeatherGrades,
        appliesLeatherSurcharge,
        allowsLaseredBrand,
        isBinaryOption,
        isQuickPick,
        isBodyLeather: usesLeatherGrades ? isBodyLeather : false,
        leatherInventoryUsage:
          usesLeatherGrades && leatherInventoryUsage !== null
            ? leatherInventoryUsage
            : null,
        gradeAUpcharge: usesLeatherGrades ? gradeAUpcharge : null,
        gradeBUpcharge: usesLeatherGrades ? gradeBUpcharge : null,
        gradeEMBUpcharge: usesLeatherGrades ? gradeEMBUpcharge : null,
        gradeHOHUpcharge: usesLeatherGrades ? gradeHOHUpcharge : null,
        gradeAxisUpcharge: usesLeatherGrades ? gradeAxisUpcharge : null,
        gradeBuffaloUpcharge: usesLeatherGrades ? gradeBuffaloUpcharge : null,
        comUpcharge: usesLeatherGrades ? comUpcharge : null,
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