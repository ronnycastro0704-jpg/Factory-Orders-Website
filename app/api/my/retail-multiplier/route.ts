import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeRetailMultiplier(value: unknown) {
  const parsed = Number(value || 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export async function PATCH(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const email = normalizeEmail(session.user.email);
    const body = await request.json();

    const retailMultiplier = normalizeRetailMultiplier(body.retailMultiplier);

    if (retailMultiplier < 1) {
      return NextResponse.json(
        { error: "Retail multiplier must be at least 1." },
        { status: 400 }
      );
    }

    if (retailMultiplier > 10) {
      return NextResponse.json(
        { error: "Retail multiplier cannot be greater than 10." },
        { status: 400 }
      );
    }

    const customer = await prisma.approvedCustomer.findFirst({
      where: {
        email,
        active: true,
      },
      select: {
        id: true,
      },
    });

    if (!customer) {
      return NextResponse.json(
        { error: "Approved customer profile not found." },
        { status: 404 }
      );
    }

    const updated = await prisma.approvedCustomer.update({
      where: {
        id: customer.id,
      },
      data: {
        retailMultiplier,
      },
      select: {
        email: true,
        name: true,
        retailMultiplier: true,
      },
    });

    return NextResponse.json({
      email: updated.email,
      name: updated.name,
      retailMultiplier: Number(updated.retailMultiplier || 1),
    });
  } catch (error) {
    console.error("UPDATE RETAIL MULTIPLIER ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update retail multiplier." },
      { status: 500 }
    );
  }
}