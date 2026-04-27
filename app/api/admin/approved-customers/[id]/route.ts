import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";

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

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const { id } = await context.params;
    const body = await request.json();

    const name = String(body.name || "").trim();
    const email = normalizeEmail(String(body.email || ""));
    const active = Boolean(body.active);

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

    const existingWithEmail = await prisma.approvedCustomer.findUnique({
      where: { email },
    });

    if (existingWithEmail && existingWithEmail.id !== id) {
      return NextResponse.json(
        { error: "Another approved customer already uses this email." },
        { status: 400 }
      );
    }

    const customer = await prisma.approvedCustomer.update({
      where: { id },
      data: {
        name,
        email,
        active,
      },
    });

    return NextResponse.json(customer);
  } catch (error) {
    console.error("UPDATE APPROVED CUSTOMER ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update approved customer." },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const { id } = await context.params;

    await prisma.approvedCustomer.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE APPROVED CUSTOMER ERROR:", error);

    return NextResponse.json(
      { error: "Failed to delete approved customer." },
      { status: 500 }
    );
  }
}