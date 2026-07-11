import { WeeklyScheduleDay } from "@prisma/client";
import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { isAdminEmail } from "../../../../../../lib/admin";
import { prisma } from "../../../../../../lib/prisma";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};


function normalizeScheduleDay(value: unknown): WeeklyScheduleDay | null | undefined {
  const raw = String(value || "").trim().toUpperCase();

  if (!raw || raw === "UNSCHEDULED") {
    return null;
  }

  if (
    raw === "MONDAY" ||
    raw === "TUESDAY" ||
    raw === "WEDNESDAY" ||
    raw === "THURSDAY" ||
    raw === "FRIDAY" ||
    raw === "SATURDAY" ||
    raw === "SUNDAY"
  ) {
    return raw as WeeklyScheduleDay;
  }

  return undefined;
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json(
        { error: "You are not authorized to schedule orders." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const weeklyScheduleDay = normalizeScheduleDay(body.weeklyScheduleDay);

    if (weeklyScheduleDay === undefined) {
      return NextResponse.json(
        { error: "Invalid schedule day." },
        { status: 400 }
      );
    }

    const order = await prisma.order.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
      },
    });

    if (!order) {
      return NextResponse.json(
        { error: "Order not found." },
        { status: 404 }
      );
    }

    if (order.status === "COMPLETED" || order.status === "CANCELLED") {
      return NextResponse.json(
        {
          error:
            "Completed or cancelled orders cannot be scheduled on the weekly board.",
        },
        { status: 400 }
      );
    }

    const updatedOrder = await prisma.order.update({
      where: { id },
      data: {
        weeklyScheduleDay,
      },
      select: {
        id: true,
        orderNumber: true,
        poNumber: true,
        customerName: true,
        customerEmail: true,
        status: true,
        priority: true,
        quantity: true,
        total: true,
        dueDate: true,
        weeklyScheduleDay: true,
        overallProductionStatus: true,
        createdAt: true,
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("UPDATE ORDER SCHEDULE ERROR:", error);

    return NextResponse.json(
      { error: "Failed to update order schedule." },
      { status: 500 }
    );
  }
}