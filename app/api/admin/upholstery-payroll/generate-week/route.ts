import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";

function normalizeText(value: unknown) {
  return String(value || "").trim();
}

function parseWeekStart(value: unknown) {
  const raw = normalizeText(value);

  if (!raw) {
    return null;
  }

  const date = new Date(`${raw}T12:00:00.000Z`);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
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

    const employeeName = normalizeText(body.employeeName);
    const weekStart = parseWeekStart(body.weekStart);

    if (!employeeName) {
      return NextResponse.json(
        { error: "Employee is required." },
        { status: 400 }
      );
    }

    if (!weekStart) {
      return NextResponse.json(
        { error: "Payroll week is required." },
        { status: 400 }
      );
    }

    const lines = await prisma.productionLine.findMany({
      where: {
        upholsteredAssignedTo: employeeName,
        upholsteredStatus: "DONE",
        order: {
          status: {
            notIn: ["CANCELLED"],
          },
        },
      },
      include: {
        order: {
          select: {
            id: true,
            orderNumber: true,
            poNumber: true,
            customerName: true,
          },
        },
      },
      orderBy: [{ updatedAt: "desc" }],
    });

    const frameRates = await prisma.upholsteryFrameRate.findMany({
      where: {
        active: true,
      },
    });

    const frameRateMap = new Map(
      frameRates.map((rate) => [
        `${rate.productName.trim().toLowerCase()}|||${rate.frameName
          .trim()
          .toLowerCase()}`,
        rate,
      ])
    );

    let createdCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;

    for (const line of lines) {
      const rateKey = `${line.productNameSnapshot.trim().toLowerCase()}|||${line.frameNeeded
        .trim()
        .toLowerCase()}`;

      const frameRate = frameRateMap.get(rateKey);

      if (!frameRate) {
        skippedCount += 1;
        continue;
      }

      const rate = Number(frameRate.rate || 0);
      const total = rate * Number(line.quantity || 0);

      const existing = await prisma.upholsteryPayrollEntry.findUnique({
        where: {
          employeeName_productionLineId_weekStart: {
            employeeName,
            productionLineId: line.id,
            weekStart,
          },
        },
      });

      if (existing) {
        await prisma.upholsteryPayrollEntry.update({
          where: {
            id: existing.id,
          },
          data: {
            orderId: line.orderId,
            orderNumber: line.order.orderNumber,
            poNumber: line.order.poNumber,
            customerName: line.order.customerName,
            productName: line.productNameSnapshot,
            partNumber: line.partNumber,
            frameName: line.frameNeeded,
            frameImageUrl: frameRate.frameImageUrl,
            quantity: line.quantity,
            rate,
            total,
          },
        });

        updatedCount += 1;
      } else {
        await prisma.upholsteryPayrollEntry.create({
          data: {
            employeeName,
            productionLineId: line.id,
            orderId: line.orderId,
            orderNumber: line.order.orderNumber,
            poNumber: line.order.poNumber,
            customerName: line.order.customerName,
            productName: line.productNameSnapshot,
            partNumber: line.partNumber,
            frameName: line.frameNeeded,
            frameImageUrl: frameRate.frameImageUrl,
            quantity: line.quantity,
            rate,
            total,
            weekStart,
            checked: false,
          },
        });

        createdCount += 1;
      }
    }

    return NextResponse.json({
      ok: true,
      createdCount,
      updatedCount,
      skippedCount,
      totalMatchingLines: lines.length,
    });
  } catch (error) {
    console.error("GENERATE UPHOLSTERY PAYROLL ERROR:", error);

    return NextResponse.json(
      { error: "Failed to generate upholstery payroll." },
      { status: 500 }
    );
  }
}