import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../../../lib/prisma";
import {
  getApprovedCustomerProfile,
  isApprovedCustomerEmail,
} from "../../../lib/approved-customer";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

function isAdminEmail(email?: string | null) {
  if (!email) return false;
  return getAdminEmails().includes(normalizeEmail(email));
}

async function isAllowedSignupEmail(email?: string | null) {
  if (!email) return false;
  return (await isApprovedCustomerEmail(email)) || isAdminEmail(email);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const submittedName = String(body.name || "").trim();
    const email = normalizeEmail(String(body.email || ""));
    const password = String(body.password || "");

    if (!email) {
      return NextResponse.json({ error: "Email is required." }, { status: 400 });
    }

    if (!(await isAllowedSignupEmail(email))) {
      return NextResponse.json(
        { error: "This email is not approved to create an account." },
        { status: 403 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const approvedCustomer = await getApprovedCustomerProfile(email);
    const finalName = approvedCustomer?.name || submittedName;

    if (!finalName) {
      return NextResponse.json({ error: "Name is required." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return NextResponse.json(
        { error: "An account with that email already exists." },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: finalName,
        email,
        passwordHash,
        role: isAdminEmail(email) ? "ADMIN" : "CUSTOMER",
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email, name: user.name },
      { status: 201 }
    );
  } catch (error) {
    console.error("SIGNUP ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create account." },
      { status: 500 }
    );
  }
}