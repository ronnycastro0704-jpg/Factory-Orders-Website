import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";

function normalizeMoney(value: unknown) {
  const parsed = Number(value || 0);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return 0;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

async function getAdminErrorResponse() {
  const session = await auth();

  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  if (!isAdminEmail(session.user.email)) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const body = await request.json();

    const productId = normalizeText(body.productId);
    const optionChoiceId = normalizeText(body.optionChoiceId);
    const productName = normalizeText(body.productName);
    const partNumber = normalizeText(body.partNumber);
    const frameName = normalizeText(body.frameName);
    const frameImageUrl = normalizeText(body.frameImageUrl);
    const rate = normalizeMoney(body.rate);

    if (!productId || !optionChoiceId || !productName || !partNumber || !frameName) {
      return NextResponse.json(
        { error: "Missing required frame rate fields." },
        { status: 400 }
      );
    }

    const frameRate = await prisma.upholsteryFrameRate.upsert({
      where: {
        productId_optionChoiceId: {
          productId,
          optionChoiceId,
        },
      },
      update: {
  productName,
  partNumber,
  frameName,
  frameImageUrl: frameImageUrl || null,
  rate,
  active: true,
},
      create: {
  productId,
  optionChoiceId,
  productName,
  partNumber,
  frameName,
  frameImageUrl: frameImageUrl || null,
  rate,
  active: true,
},
    });

    return NextResponse.json(frameRate);
  } catch (error) {
    console.error("UPSERT UPHOLSTERY FRAME RATE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to save frame rate." },
      { status: 500 }
    );
  }
}