import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { isAdminEmail } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const { id } = await context.params;
    const body = await request.json();

    const checked = Boolean(body.checked);

    const entry = await prisma.upholsteryPayrollEntry.update({
      where: {
        id,
      },
      data: {
        checked,
        checkedAt: checked ? new Date() : null,
      },
    });

    return NextResponse.json(entry);
  } catch (error) {
    console.error("UPDATE UPHOLSTERY PAYROLL ENTRY ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update payroll entry." },
      { status: 500 }
    );
  }
}