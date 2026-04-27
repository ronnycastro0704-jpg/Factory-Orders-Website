import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

    const name = String(body.name || "").trim();
    const email = normalizeEmail(String(body.email || ""));

    if (!name) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!email || !isValidEmail(email)) {
      return NextResponse.json(
        { error: "A valid customer email is required." },
        { status: 400 }
      );
    }

    const existing = await prisma.approvedCustomer.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "This customer email is already approved." },
        { status: 400 }
      );
    }

    const customer = await prisma.approvedCustomer.create({
      data: {
        name,
        email,
        active: true,
      },
    });

    return NextResponse.json(customer, { status: 201 });
  } catch (error) {
    console.error("CREATE APPROVED CUSTOMER ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create approved customer." },
      { status: 500 }
    );
  }
}