import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: {
        id,
      },
      include: {
        orders: {
          orderBy: {
            createdAt: "asc",
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                poNumber: true,
                status: true,
                overallProductionStatus: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    return NextResponse.json(invoice);
  } catch (error) {
    console.error("GET INVOICE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to load invoice." },
      { status: 500 }
    );
  }
}