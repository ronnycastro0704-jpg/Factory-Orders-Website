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
  | "HOT"
  | "IN_PROGRESS"
  | "FRAME_DONE"
  | "THIS_WEEK"
  | "DONE"
  | "MISSING_LEATHER"
  | "BLOCKED"
  | "NA";

  type OrderStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "CHANGED"
  | "SENT_TO_FACTORY"
  | "COMPLETED"
  | "PAID"
  | "CANCELLED";

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

const MILL_FIRST_VALUES = new Set<ProductionStageStatus>([
  "NOT_STARTED",
  "HOT",
  "IN_PROGRESS",
  "FRAME_DONE",
  "THIS_WEEK",
  "DONE",
  "NA",
  "BLOCKED",
]);

const GENERIC_STAGE_VALUES = new Set<ProductionStageStatus>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "NA",
  "BLOCKED",
]);

const LEA_CUT_VALUES = new Set<ProductionStageStatus>([
  "NOT_STARTED",
  "IN_PROGRESS",
  "DONE",
  "MISSING_LEATHER",
  "NA",
  "BLOCKED",
]);

function normalizeStageStatus(
  value: unknown,
  fallback: ProductionStageStatus,
  allowedValues: Set<ProductionStageStatus>
): ProductionStageStatus {
  const raw = String(value ?? "")
    .trim()
    .toUpperCase() as ProductionStageStatus;

  if (!raw) {
    return fallback;
  }

  return allowedValues.has(raw) ? raw : fallback;
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

function isStarted(status: ProductionStageStatus) {
  return !["NOT_STARTED", "NA"].includes(status);
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

  if (input.leaCutStatus === "MISSING_LEATHER") {
    return "WAITING_ON_LEATHER";
  }

  if (input.qcStatus === "DONE") {
    return "READY";
  }

  if (isStarted(input.qcStatus)) {
    return "QC";
  }

  if (isStarted(input.finalAssemblyStatus)) {
    return "FINAL_ASSEMBLY";
  }

  if (isStarted(input.upholsteryStatus) || isStarted(input.upholsteredStatus)) {
    return "UPHOLSTERY";
  }

  if (isStarted(input.sewnStatus)) {
    return "SEWING";
  }

  if (isStarted(input.leaCutStatus)) {
    return "CUTTING";
  }

  const preProduction = [
    input.millFirstStatus,
    input.leatherOrderedStatus,
    input.millStatus,
    input.frameAssemblyStatus,
    input.leatherArrivedStatus,
  ];

  if (preProduction.some((status) => isStarted(status))) {
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

function deriveNextOrderStatus(
  currentOrderStatus: OrderStatus,
  productionStatus: ProductionOverallStatus
): OrderStatus {
  if (currentOrderStatus === "PAID" || currentOrderStatus === "CANCELLED") {
    return currentOrderStatus;
  }

  if (productionStatus === "READY" || productionStatus === "PICKED_UP") {
    return "COMPLETED";
  }

  return currentOrderStatus;
}

const PRODUCTION_STATUS_ORDER: ProductionOverallStatus[] = [
  "NEW",
  "WAITING_ON_LEATHER",
  "CUTTING",
  "SEWING",
  "UPHOLSTERY",
  "FINAL_ASSEMBLY",
  "QC",
  "READY",
  "PICKED_UP",
];

const OVERALL_STATUS_VALUES = new Set<ProductionOverallStatus>([
  "NEW",
  "WAITING_ON_LEATHER",
  "CUTTING",
  "SEWING",
  "UPHOLSTERY",
  "FINAL_ASSEMBLY",
  "QC",
  "READY",
  "PICKED_UP",
  "BLOCKED",
]);

type StageField =
  | "millFirstStatus"
  | "leatherOrderedStatus"
  | "millStatus"
  | "frameAssemblyStatus"
  | "leatherArrivedStatus"
  | "leaCutStatus"
  | "sewnStatus"
  | "upholsteryStatus"
  | "upholsteredStatus"
  | "finalAssemblyStatus"
  | "qcStatus";

type KanbanMoveState = Record<StageField, ProductionStageStatus> & {
  pickedUp: boolean;
  pickedUpAt: Date | null;
};

const STAGE_FIELDS: StageField[] = [
  "millFirstStatus",
  "leatherOrderedStatus",
  "millStatus",
  "frameAssemblyStatus",
  "leatherArrivedStatus",
  "leaCutStatus",
  "sewnStatus",
  "upholsteryStatus",
  "upholsteredStatus",
  "finalAssemblyStatus",
  "qcStatus",
];

function normalizeOverallStatus(value: unknown) {
  const raw = String(value || "")
    .trim()
    .toUpperCase() as ProductionOverallStatus;

  return OVERALL_STATUS_VALUES.has(raw) ? raw : null;
}

function canMoveByDrag(
  currentStatus: ProductionOverallStatus,
  targetStatus: ProductionOverallStatus
) {
  if (currentStatus === targetStatus) {
    return {
      allowed: false,
      error: "This line is already in that kanban column.",
    };
  }

  if (currentStatus === "PICKED_UP") {
    return {
      allowed: false,
      error:
        "Picked up lines cannot be moved by dragging. Open the production detail page if this was marked incorrectly.",
    };
  }

  if (currentStatus === "BLOCKED" && targetStatus !== "BLOCKED") {
    return {
      allowed: false,
      error:
        "Blocked lines must be unblocked from the production detail page so the blocked dropdown can be cleared intentionally.",
    };
  }

  if (targetStatus === "BLOCKED") {
    return {
      allowed: true,
      error: "",
    };
  }

  const currentIndex = PRODUCTION_STATUS_ORDER.indexOf(currentStatus);
  const targetIndex = PRODUCTION_STATUS_ORDER.indexOf(targetStatus);

  if (currentIndex === -1 || targetIndex === -1) {
    return {
      allowed: false,
      error: "This kanban move is not supported.",
    };
  }

  if (targetIndex <= currentIndex) {
    return {
      allowed: false,
      error:
        "Backward drag moves are disabled so completed production steps are not accidentally undone. Open the production detail page to move a line backward.",
    };
  }

  return {
    allowed: true,
    error: "",
  };
}

function buildInitialKanbanMoveState(existingLine: {
  millFirstStatus: unknown;
  leatherOrderedStatus: unknown;
  millStatus: unknown;
  frameAssemblyStatus: unknown;
  leatherArrivedStatus: unknown;
  leaCutStatus: unknown;
  sewnStatus: unknown;
  upholsteryStatus: unknown;
  upholsteredStatus: unknown; 
  finalAssemblyStatus: unknown;
  qcStatus: unknown;
  pickedUp: boolean;
  pickedUpAt: Date | null;
}): KanbanMoveState {
  return {
    millFirstStatus: existingLine.millFirstStatus as ProductionStageStatus,
    leatherOrderedStatus:
      existingLine.leatherOrderedStatus as ProductionStageStatus,
    millStatus: existingLine.millStatus as ProductionStageStatus,
    frameAssemblyStatus:
      existingLine.frameAssemblyStatus as ProductionStageStatus,
    leatherArrivedStatus:
      existingLine.leatherArrivedStatus as ProductionStageStatus,
    leaCutStatus: existingLine.leaCutStatus as ProductionStageStatus,
    sewnStatus: existingLine.sewnStatus as ProductionStageStatus,
    upholsteryStatus: existingLine.upholsteryStatus as ProductionStageStatus,
    upholsteredStatus: existingLine.upholsteredStatus as ProductionStageStatus,
    finalAssemblyStatus:
      existingLine.finalAssemblyStatus as ProductionStageStatus,
    qcStatus: existingLine.qcStatus as ProductionStageStatus,
    pickedUp: false,
    pickedUpAt: null,
  };
}

function markWaitingOnLeatherDone(state: KanbanMoveState) {
  state.millFirstStatus = "DONE";
  state.leatherOrderedStatus = "DONE";
}

function markReadyForCuttingDone(state: KanbanMoveState) {
  markWaitingOnLeatherDone(state);
  state.millStatus = "DONE";
  state.frameAssemblyStatus = "DONE";
  state.leatherArrivedStatus = "DONE";
}

function markCuttingDone(state: KanbanMoveState) {
  markReadyForCuttingDone(state);
  state.leaCutStatus = "DONE";
}

function markSewingDone(state: KanbanMoveState) {
  markCuttingDone(state);
  state.sewnStatus = "DONE";
}

function markUpholsteryDone(state: KanbanMoveState) {
  markSewingDone(state);
  state.upholsteryStatus = "DONE";
  state.upholsteredStatus = "DONE";
}

function markFinalAssemblyDone(state: KanbanMoveState) {
  markUpholsteryDone(state);
  state.finalAssemblyStatus = "DONE";
}

function markReadyDone(state: KanbanMoveState) {
  markFinalAssemblyDone(state);
  state.qcStatus = "DONE";
}

function getBlockedStageField(state: KanbanMoveState): StageField {
  if (isStarted(state.qcStatus)) return "qcStatus";
  if (isStarted(state.finalAssemblyStatus)) return "finalAssemblyStatus";
  if (isStarted(state.upholsteryStatus)) return "upholsteryStatus";
  if (isStarted(state.upholsteredStatus)) return "upholsteredStatus";
  if (isStarted(state.sewnStatus)) return "sewnStatus";
  if (isStarted(state.leaCutStatus)) return "leaCutStatus";
  if (isStarted(state.leatherArrivedStatus)) return "leatherArrivedStatus";
  if (isStarted(state.frameAssemblyStatus)) return "frameAssemblyStatus";
  if (isStarted(state.millStatus)) return "millStatus";
  if (isStarted(state.leatherOrderedStatus)) return "leatherOrderedStatus";
  if (isStarted(state.millFirstStatus)) return "millFirstStatus";

  return "leaCutStatus";
}

function applyKanbanMoveState(
  state: KanbanMoveState,
  targetStatus: ProductionOverallStatus
) {
  switch (targetStatus) {
case "WAITING_ON_LEATHER":
  markWaitingOnLeatherDone(state);
  break;

    case "CUTTING":
      markCuttingDone(state);
      break;

    case "SEWING":
      markSewingDone(state);
      break;

    case "UPHOLSTERY":
      markUpholsteryDone(state);
      break;

    case "FINAL_ASSEMBLY":
      markFinalAssemblyDone(state);
      break;

    case "QC":
      markFinalAssemblyDone(state);
      state.qcStatus = "IN_PROGRESS";
      break;

    case "READY":
      markReadyDone(state);
      break;

    case "PICKED_UP":
      markReadyDone(state);
      state.pickedUp = true;
      state.pickedUpAt = new Date();
      break;

    case "BLOCKED": {
      const alreadyBlocked = STAGE_FIELDS.some(
        (field) => state[field] === "BLOCKED"
      );

      if (!alreadyBlocked) {
        state[getBlockedStageField(state)] = "BLOCKED";
      }

      break;
    }

    case "NEW":
    default:
      break;
  }
}

async function updateOrderStatusAndSyncSheets(args: {
  existingLine: {
    orderId: string;
order: {
  poNumber: string | null;
  customerName: string;
  status: OrderStatus;
  pickedUpAt: Date | null;
};
  };
  updatedLine: {
    partNumber: string;
    frameNeeded: string;
    quantity: number;
    bodyLeather: string | null;
    dueDate: Date | null;
    millFirstStatus: unknown;
    leatherOrderedStatus: unknown;
    millStatus: unknown;
    frameAssemblyStatus: unknown;
    leatherArrivedStatus: unknown;
    leaCutStatus: unknown;
    sewnStatus: unknown;
    upholsteryStatus: unknown;
    upholsteredStatus: unknown;
    finalAssemblyStatus: unknown;
    qcStatus: unknown;
    leaCutAssignedTo: string | null;
    upholsteredAssignedTo: string | null;
    qcAssignedTo: string | null;
    pickedUp: boolean;
    pickedUpAt: Date | null;
  };
}) {
  const { existingLine, updatedLine } = args;

  const siblingLines = await prisma.productionLine.findMany({
    where: { orderId: existingLine.orderId },
    select: {
      id: true,
      currentStatus: true,
      pickedUp: true,
    },
  });

const orderStatus = deriveOrderOverallStatus(siblingLines);
const nextOrderStatus = deriveNextOrderStatus(
  existingLine.order.status,
  orderStatus
);

const allPickedUp =
  siblingLines.length > 0 && siblingLines.every((line) => line.pickedUp);

await prisma.order.update({
  where: { id: existingLine.orderId },
  data: {
    status: nextOrderStatus,
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

      leaCutAssignedTo: updatedLine.leaCutAssignedTo,
      upholsteredAssignedTo: updatedLine.upholsteredAssignedTo,
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
        status: true,
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

    if (body.moveToStatus !== undefined) {
  const targetStatus = normalizeOverallStatus(body.moveToStatus);

  if (!targetStatus) {
    return NextResponse.json(
      { error: "Invalid kanban status." },
      { status: 400 }
    );
  }

  const currentStatus = existingLine.currentStatus as ProductionOverallStatus;
  const moveCheck = canMoveByDrag(currentStatus, targetStatus);

  if (!moveCheck.allowed) {
    return NextResponse.json(
      { error: moveCheck.error },
      { status: 400 }
    );
  }

  const nextState = buildInitialKanbanMoveState(existingLine);

  applyKanbanMoveState(nextState, targetStatus);

  const nextCurrentStatus = deriveLineCurrentStatus({
    pickedUp: nextState.pickedUp,
    millFirstStatus: nextState.millFirstStatus,
    leatherOrderedStatus: nextState.leatherOrderedStatus,
    millStatus: nextState.millStatus,
    frameAssemblyStatus: nextState.frameAssemblyStatus,
    leatherArrivedStatus: nextState.leatherArrivedStatus,
    leaCutStatus: nextState.leaCutStatus,
    sewnStatus: nextState.sewnStatus,
    upholsteryStatus: nextState.upholsteryStatus,
    upholsteredStatus: nextState.upholsteredStatus,
    finalAssemblyStatus: nextState.finalAssemblyStatus,
    qcStatus: nextState.qcStatus,
  });

  const updatedLine = await prisma.productionLine.update({
    where: { id },
    data: {
      millFirstStatus: nextState.millFirstStatus,
      leatherOrderedStatus: nextState.leatherOrderedStatus,
      millStatus: nextState.millStatus,
      frameAssemblyStatus: nextState.frameAssemblyStatus,
      leatherArrivedStatus: nextState.leatherArrivedStatus,
      leaCutStatus: nextState.leaCutStatus,
      sewnStatus: nextState.sewnStatus,
      upholsteryStatus: nextState.upholsteryStatus,
      upholsteredStatus: nextState.upholsteredStatus,
      finalAssemblyStatus: nextState.finalAssemblyStatus,
      qcStatus: nextState.qcStatus,
      pickedUp: nextState.pickedUp,
      pickedUpAt: nextState.pickedUpAt,
      currentStatus: nextCurrentStatus,
    },
  });

  await updateOrderStatusAndSyncSheets({
    existingLine,
    updatedLine,
  });

  return NextResponse.json(updatedLine);
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
      existingLine.millFirstStatus as ProductionStageStatus,
      MILL_FIRST_VALUES
    );
    const leatherOrderedStatus = normalizeStageStatus(
      body.leatherOrderedStatus,
      existingLine.leatherOrderedStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const millStatus = normalizeStageStatus(
      body.millStatus,
      existingLine.millStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const frameAssemblyStatus = normalizeStageStatus(
      body.frameAssemblyStatus,
      existingLine.frameAssemblyStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const leatherArrivedStatus = normalizeStageStatus(
      body.leatherArrivedStatus,
      existingLine.leatherArrivedStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const leaCutStatus = normalizeStageStatus(
      body.leaCutStatus,
      existingLine.leaCutStatus as ProductionStageStatus,
      LEA_CUT_VALUES
    );
    const sewnStatus = normalizeStageStatus(
      body.sewnStatus,
      existingLine.sewnStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const upholsteryStatus = normalizeStageStatus(
      body.upholsteryStatus,
      existingLine.upholsteryStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const upholsteredStatus = normalizeStageStatus(
      body.upholsteredStatus,
      existingLine.upholsteredStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const finalAssemblyStatus = normalizeStageStatus(
      body.finalAssemblyStatus,
      existingLine.finalAssemblyStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
    );
    const qcStatus = normalizeStageStatus(
      body.qcStatus,
      existingLine.qcStatus as ProductionStageStatus,
      GENERIC_STAGE_VALUES
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
        priority: normalizePriority(
          body.priority,
          existingLine.priority as OrderPriority
        ),
        lineNotes: normalizeOptionalText(body.lineNotes),
        completedPhotoUrl: normalizeOptionalText(body.completedPhotoUrl),

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

        leaCutAssignedTo: normalizeOptionalText(body.leaCutAssignedTo),
        upholsteredAssignedTo: normalizeOptionalText(body.upholsteredAssignedTo),
        qcAssignedTo: normalizeOptionalText(body.qcAssignedTo),

        upholsteryAssignedTo: null,
        finalAssemblyAssignedTo: null,

        pickedUp,
        pickedUpAt,
        currentStatus,
      },
    });

await updateOrderStatusAndSyncSheets({
  existingLine,
  updatedLine,
});

return NextResponse.json(updatedLine);
  } catch (error) {
    console.error("UPDATE PRODUCTION LINE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update production line." },
      { status: 500 }
    );
  }
}