import { NextResponse } from "next/server";
import { auth } from "../../../../../auth";
import { isAdminEmail } from "../../../../../lib/admin";
import { prisma } from "../../../../../lib/prisma";
import { updateProductionTrackingRow } from "../../../../../lib/sheets";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type ProductionStageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DONE"
  | "BLOCKED"
  | "NA";

type ProductionOverallStatus =
  | "NEW"
  | "WAITING_ON_LEATHER"
  | "CUTTING"
  | "SEWING"
  | "UPHOLSTERY"
  | "FINAL_ASSEMBLY"
  | "QC"
  | "READY"
  | "PICKED_UP"
  | "BLOCKED";

type OrderPriority = "NORMAL" | "RUSH" | "HOLD";

const STAGE_STATUS_VALUES = new Set<ProductionStageStatus>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "BLOCKED",
  "NA",
]);

function normalizeStageStatus(
  value: unknown,
  fallback: ProductionStageStatus = "NOT_STARTED"
): ProductionStageStatus {
  const raw = String(value || "")
    .trim()
    .toUpperCase() as ProductionStageStatus;

  return STAGE_STATUS_VALUES.has(raw) ? raw : fallback;
}

function normalizePriority(
  value: unknown,
  fallback: OrderPriority = "NORMAL"
): OrderPriority {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "HOT") {
    return "HOLD";
  }

  if (raw === "NORMAL" || raw === "RUSH" || raw === "HOLD") {
    return raw;
  }

  return fallback;
}

function normalizeOptionalText(value: unknown) {
  const raw = String(value || "").trim();
  return raw ? raw : null;
}

function parseOptionalDate(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) {
    return { raw, date: null as Date | null, isValid: true };
  }

  const date = new Date(raw);

  return {
    raw,
    date: Number.isNaN(date.getTime()) ? null : date,
    isValid: !Number.isNaN(date.getTime()),
  };
}

function hasProgress(status: ProductionStageStatus) {
  return status === "IN_PROGRESS" || status === "DONE";
}

function deriveLineCurrentStatus(input: {
  pickedUp: boolean;
  millFirstStatus: ProductionStageStatus;
  leatherOrderedStatus: ProductionStageStatus;
  millStatus: ProductionStageStatus;
  frameAssemblyStatus: ProductionStageStatus;
  leatherArrivedStatus: ProductionStageStatus;
  leaCutStatus: ProductionStageStatus;
  sewnStatus: ProductionStageStatus;
  upholsteryStatus: ProductionStageStatus;
  upholsteredStatus: ProductionStageStatus;
  finalAssemblyStatus: ProductionStageStatus;
  qcStatus: ProductionStageStatus;
}): ProductionOverallStatus {
  if (input.pickedUp) {
    return "PICKED_UP";
  }

  const allStatuses: ProductionStageStatus[] = [
    input.millFirstStatus,
    input.leatherOrderedStatus,
    input.millStatus,
    input.frameAssemblyStatus,
    input.leatherArrivedStatus,
    input.leaCutStatus,
    input.sewnStatus,
    input.upholsteryStatus,
    input.upholsteredStatus,
    input.finalAssemblyStatus,
    input.qcStatus,
  ];

  if (allStatuses.includes("BLOCKED")) {
    return "BLOCKED";
  }

  if (input.qcStatus === "IN_PROGRESS") {
    return "QC";
  }

  if (input.qcStatus === "DONE") {
    return "READY";
  }

  if (
    input.finalAssemblyStatus === "IN_PROGRESS" ||
    input.finalAssemblyStatus === "DONE"
  ) {
    return "FINAL_ASSEMBLY";
  }

  if (
    input.upholsteryStatus === "IN_PROGRESS" ||
    input.upholsteryStatus === "DONE" ||
    input.upholsteredStatus === "IN_PROGRESS" ||
    input.upholsteredStatus === "DONE"
  ) {
    return "UPHOLSTERY";
  }

  if (input.sewnStatus === "IN_PROGRESS" || input.sewnStatus === "DONE") {
    return "SEWING";
  }

  if (input.leaCutStatus === "IN_PROGRESS" || input.leaCutStatus === "DONE") {
    return "CUTTING";
  }

  const preProduction = [
    input.millFirstStatus,
    input.leatherOrderedStatus,
    input.millStatus,
    input.frameAssemblyStatus,
    input.leatherArrivedStatus,
  ];

  if (preProduction.some((status) => hasProgress(status))) {
    return "WAITING_ON_LEATHER";
  }

  return "NEW";
}

function deriveOrderOverallStatus(
  lines: Array<{ currentStatus: string; pickedUp: boolean }>
): ProductionOverallStatus {
  if (lines.length === 0) {
    return "NEW";
  }

  if (lines.every((line) => line.pickedUp)) {
    return "PICKED_UP";
  }

  if (lines.some((line) => line.currentStatus === "BLOCKED")) {
    return "BLOCKED";
  }

  if (lines.some((line) => line.currentStatus === "NEW")) {
    return "NEW";
  }

  if (lines.some((line) => line.currentStatus === "WAITING_ON_LEATHER")) {
    return "WAITING_ON_LEATHER";
  }

  if (lines.some((line) => line.currentStatus === "CUTTING")) {
    return "CUTTING";
  }

  if (lines.some((line) => line.currentStatus === "SEWING")) {
    return "SEWING";
  }

  if (lines.some((line) => line.currentStatus === "UPHOLSTERY")) {
    return "UPHOLSTERY";
  }

  if (lines.some((line) => line.currentStatus === "FINAL_ASSEMBLY")) {
    return "FINAL_ASSEMBLY";
  }

  if (lines.some((line) => line.currentStatus === "QC")) {
    return "QC";
  }

  if (lines.every((line) => line.currentStatus === "READY")) {
    return "READY";
  }

  return "NEW";
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json(
        { error: "You are not authorized to update production lines." },
        { status: 403 }
      );
    }

    const { id } = await context.params;
    const body = await request.json();

    const existingLine = await prisma.productionLine.findUnique({
      where: { id },
      include: {
        order: {
          select: {
            id: true,
            poNumber: true,
            customerName: true,
            pickedUpAt: true,
          },
        },
      },
    });

    if (!existingLine) {
      return NextResponse.json(
        { error: "Production line not found." },
        { status: 404 }
      );
    }

    const dueDateInput = parseOptionalDate(body.dueDate);
    const pickedUpAtInput = parseOptionalDate(body.pickedUpAt);

    if (!dueDateInput.isValid) {
      return NextResponse.json(
        { error: "Due date is invalid." },
        { status: 400 }
      );
    }

    if (!pickedUpAtInput.isValid) {
      return NextResponse.json(
        { error: "Picked up date is invalid." },
        { status: 400 }
      );
    }

    const pickedUpAt = pickedUpAtInput.date;
    const pickedUp = Boolean(pickedUpAt);

    const millFirstStatus = normalizeStageStatus(
      body.millFirstStatus,
      existingLine.millFirstStatus as ProductionStageStatus
    );
    const leatherOrderedStatus = normalizeStageStatus(
      body.leatherOrderedStatus,
      existingLine.leatherOrderedStatus as ProductionStageStatus
    );
    const millStatus = normalizeStageStatus(
      body.millStatus,
      existingLine.millStatus as ProductionStageStatus
    );
    const frameAssemblyStatus = normalizeStageStatus(
      body.frameAssemblyStatus,
      existingLine.frameAssemblyStatus as ProductionStageStatus
    );
    const leatherArrivedStatus = normalizeStageStatus(
      body.leatherArrivedStatus,
      existingLine.leatherArrivedStatus as ProductionStageStatus
    );
    const leaCutStatus = normalizeStageStatus(
      body.leaCutStatus,
      existingLine.leaCutStatus as ProductionStageStatus
    );
    const sewnStatus = normalizeStageStatus(
      body.sewnStatus,
      existingLine.sewnStatus as ProductionStageStatus
    );
    const upholsteryStatus = normalizeStageStatus(
      body.upholsteryStatus,
      existingLine.upholsteryStatus as ProductionStageStatus
    );
    const upholsteredStatus = normalizeStageStatus(
      body.upholsteredStatus,
      existingLine.upholsteredStatus as ProductionStageStatus
    );
    const finalAssemblyStatus = normalizeStageStatus(
      body.finalAssemblyStatus,
      existingLine.finalAssemblyStatus as ProductionStageStatus
    );
    const qcStatus = normalizeStageStatus(
      body.qcStatus,
      existingLine.qcStatus as ProductionStageStatus
    );

    const currentStatus = deriveLineCurrentStatus({
      pickedUp,
      millFirstStatus,
      leatherOrderedStatus,
      millStatus,
      frameAssemblyStatus,
      leatherArrivedStatus,
      leaCutStatus,
      sewnStatus,
      upholsteryStatus,
      upholsteredStatus,
      finalAssemblyStatus,
      qcStatus,
    });

    const updatedLine = await prisma.productionLine.update({
      where: { id },
      data: {
        bodyLeather: normalizeOptionalText(body.bodyLeather),
        dueDate: dueDateInput.date,
        priority: normalizePriority(body.priority, existingLine.priority as OrderPriority),
        lineNotes: normalizeOptionalText(body.lineNotes),

        millFirstStatus,
        leatherOrderedStatus,
        millStatus,
        frameAssemblyStatus,
        leatherArrivedStatus,
        leaCutStatus,
        sewnStatus,
        upholsteryStatus,
        upholsteredStatus,
        finalAssemblyStatus,
        qcStatus,

        upholsteryAssignedTo: normalizeOptionalText(body.upholsteryAssignedTo),
        upholsteredAssignedTo: normalizeOptionalText(body.upholsteredAssignedTo),
        finalAssemblyAssignedTo: normalizeOptionalText(
          body.finalAssemblyAssignedTo
        ),
        qcAssignedTo: normalizeOptionalText(body.qcAssignedTo),

        pickedUp,
        pickedUpAt,
        currentStatus,
      },
    });

    const siblingLines = await prisma.productionLine.findMany({
      where: { orderId: existingLine.orderId },
      select: {
        id: true,
        currentStatus: true,
        pickedUp: true,
      },
    });

    const orderStatus = deriveOrderOverallStatus(siblingLines);
    const allPickedUp =
      siblingLines.length > 0 && siblingLines.every((line) => line.pickedUp);

    await prisma.order.update({
      where: { id: existingLine.orderId },
      data: {
        overallProductionStatus: orderStatus,
        pickedUp: allPickedUp,
        pickedUpAt: allPickedUp
          ? updatedLine.pickedUpAt ?? existingLine.order.pickedUpAt ?? new Date()
          : null,
      },
    });

    try {
      const syncResult = await updateProductionTrackingRow({
        poNumber: existingLine.order.poNumber,
        customerName: existingLine.order.customerName,
        partNumber: updatedLine.partNumber,
        frameNeeded: updatedLine.frameNeeded,
        quantity: updatedLine.quantity,
        bodyLeather: updatedLine.bodyLeather,
        dueDate: updatedLine.dueDate,

        millFirstStatus: updatedLine.millFirstStatus as ProductionStageStatus,
        leatherOrderedStatus:
          updatedLine.leatherOrderedStatus as ProductionStageStatus,
        millStatus: updatedLine.millStatus as ProductionStageStatus,
        frameAssemblyStatus:
          updatedLine.frameAssemblyStatus as ProductionStageStatus,
        leatherArrivedStatus:
          updatedLine.leatherArrivedStatus as ProductionStageStatus,
        leaCutStatus: updatedLine.leaCutStatus as ProductionStageStatus,
        sewnStatus: updatedLine.sewnStatus as ProductionStageStatus,
        upholsteryStatus: updatedLine.upholsteryStatus as ProductionStageStatus,
        upholsteredStatus:
          updatedLine.upholsteredStatus as ProductionStageStatus,
        finalAssemblyStatus:
          updatedLine.finalAssemblyStatus as ProductionStageStatus,
        qcStatus: updatedLine.qcStatus as ProductionStageStatus,

        upholsteryAssignedTo: updatedLine.upholsteryAssignedTo,
        upholsteredAssignedTo: updatedLine.upholsteredAssignedTo,
        finalAssemblyAssignedTo: updatedLine.finalAssemblyAssignedTo,
        qcAssignedTo: updatedLine.qcAssignedTo,

        pickedUp: updatedLine.pickedUp,
        pickedUpAt: updatedLine.pickedUpAt,
      });

      await prisma.sheetSyncLog.create({
        data: {
          orderId: existingLine.orderId,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: syncResult.worksheetName,
          spreadsheetRowId: syncResult.rowNumber
            ? String(syncResult.rowNumber)
            : "ROW_NOT_FOUND",
          status: syncResult.updated ? "SYNCED" : "FAILED",
          errorMessage: syncResult.updated
            ? null
            : "No matching Orders sheet row was found for this production line.",
        },
      });
    } catch (error) {
      console.error("PRODUCTION LINE SHEETS SYNC ERROR:", error);

      await prisma.sheetSyncLog.create({
        data: {
          orderId: existingLine.orderId,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "UPDATE_FAILED",
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown sheets sync error",
        },
      });
    }

    return NextResponse.json(updatedLine);
  } catch (error) {
    console.error("UPDATE PRODUCTION LINE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update production line." },
      { status: 500 }
    );
  }
}