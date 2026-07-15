import { NextResponse } from "next/server";
import { EmployeeDepartment } from "@prisma/client";
import { auth } from "../../../../auth";
import { isAdminEmail } from "../../../../lib/admin";
import { prisma } from "../../../../lib/prisma";

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

export async function POST(request: Request) {
  try {
    const adminErrorResponse = await getAdminErrorResponse();

    if (adminErrorResponse) {
      return adminErrorResponse;
    }

    const body = await request.json();

    const name = normalizeName(body.name);
    const department = normalizeDepartment(body.department);

    if (!name) {
      return NextResponse.json(
        { error: "Employee name is required." },
        { status: 400 }
      );
    }

    const employee = await prisma.employee.create({
      data: {
        name,
        department,
        active: true,
      },
    });

    return NextResponse.json(employee, { status: 201 });
  } catch (error) {
    console.error("CREATE EMPLOYEE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to create employee." },
      { status: 500 }
    );
  }
}