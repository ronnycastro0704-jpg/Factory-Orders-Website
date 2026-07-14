import { createHash, randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/prisma";
import { sendPasswordResetEmail } from "../../../../lib/email";
import { isApprovedCustomerEmail } from "../../../../lib/approved-customer";

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

async function isAllowedResetEmail(email?: string | null) {
  if (!email) return false;
  return (await isApprovedCustomerEmail(email)) || isAdminEmail(email);
}

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getBaseUrl(request: Request) {
  const envUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.AUTH_URL ||
    process.env.NEXTAUTH_URL;

  if (envUrl) {
    return envUrl.replace(/\/$/, "");
  }

  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const email = normalizeEmail(String(body.email || ""));

    if (!email) {
      return NextResponse.json({
        success: true,
        message: "If an account exists for that email, we sent a reset link.",
      });
    }

    const allowed = await isAllowedResetEmail(email);

    const user = allowed
      ? await prisma.user.findUnique({
          where: { email },
          select: {
            id: true,
            email: true,
          },
        })
      : null;

    if (user) {
      await prisma.passwordResetToken.updateMany({
        where: {
          email,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        data: {
          usedAt: new Date(),
        },
      });

      const token = randomBytes(32).toString("hex");
      const tokenHash = hashToken(token);
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);

      await prisma.passwordResetToken.create({
        data: {
          email,
          tokenHash,
          expiresAt,
        },
      });

      const resetUrl = `${getBaseUrl(request)}/reset-password/${token}`;

      await sendPasswordResetEmail({
        email,
        resetUrl,
      });
    }

    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, we sent a reset link.",
    });
  } catch (error) {
    console.error("FORGOT PASSWORD ERROR:", error);

    return NextResponse.json({
      success: true,
      message: "If an account exists for that email, we sent a reset link.",
    });
  }
}