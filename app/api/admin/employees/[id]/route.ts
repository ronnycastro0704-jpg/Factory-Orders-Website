import { NextResponse } from "next/server";
import { EmployeeDepartment } from "@prisma/client";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function normalizeName(value: unknown) {
  return String(value || "").trim();
}

function normalizeDepartment(value: unknown): EmployeeDepartment {
  const raw = String(value || "").trim().toUpperCase();

  if (
    raw === "CUTTING" ||
    raw === "SEWING" ||
    raw === "UPHOLSTERY" ||
    raw === "ASSEMBLY" ||
    raw === "QC" ||
    raw === "GENERAL"
  ) {
    return raw;
  }

  return "GENERAL";
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

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const { id } = await context.params;
    const body = await request.json();

    const name = normalizeName(body.name);
    const department = normalizeDepartment(body.department);
    const active = Boolean(body.active);

    if (!name) {
      return NextResponse.json(
        { error: "Employee name is required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name,
        department,
        active,
      },
    });

    return NextResponse.json(employee);
  } catch (error) {
    console.error("UPDATE EMPLOYEE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update employee." },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const { id } = await context.params;

    await prisma.employee.delete({
      where: { id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("DELETE EMPLOYEE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to delete employee." },
      { status: 500 }
    );
  }
}