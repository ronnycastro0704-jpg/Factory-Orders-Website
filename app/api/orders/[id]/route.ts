import { NextResponse } from "next/server";
import { OrderStatus, Prisma } from "@prisma/client";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { sendOrderNotification } from "../../../../lib/email";
import { getApprovedCustomerProfile } from "../../../../lib/approved-customer";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type IncomingSelection = {
  groupName: string;
  choiceLabel: string;
  choiceValue?: string | null;
  partNumber?: string | null;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount: number;
  leatherSurcharge: number;
  imageUrl?: string | null;
  leatherImageUrl?: string | null;
laseredBrand?: boolean;
laseredBrandSurcharge?: number | null;
laseredBrandImageUrl?: string | null;
  quantity?: number | null;
  frameNeededCode?: string | null;
  isBodyLeather?: boolean;
  leatherInventoryUsage?: number | null;
};

type ResolvedSelection = IncomingSelection & {
  leatherInventoryUsage: number;
};

type IncomingLineItem = {
  label: string;
  amount: number;
};

type OrderPriority = "NORMAL" | "RUSH" | "HOLD";

type ProductionLineSeed = {
  productNameSnapshot: string;
  optionGroupNameSnapshot: string | null;
  optionChoiceNameSnapshot: string | null;
  partNumber: string;
  frameNeeded: string;
  quantity: number;
  bodyLeather: string | null;
  dueDate: Date | null;
  priority: OrderPriority;
};

type RevisionSelectionSnapshot = {
  selections: IncomingSelection[];
  quantity: number;
};

type LeatherInventoryDelta = {
  leatherName: string;
  units: number;
};

const SELECTION_META_SEPARATOR = "|||";
const ORDER_PRIORITIES = new Set<OrderPriority>(["NORMAL", "RUSH", "HOLD"]);

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeEmailList(value: unknown) {
  const rawValues = Array.isArray(value) ? value : [value];

  return Array.from(
    new Set(
      rawValues
        .flatMap((item) => String(item || "").split(/[\s,;]+/))
        .map((item) => normalizeEmail(item))
        .filter(Boolean)
    )
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getInvalidEmails(emails: string[]) {
  return emails.filter((email) => !isValidEmail(email));
}

function getOrderNotificationEmails(order: {
  customerEmail: string;
  notificationEmails?: string[] | null;
}) {
  const emails = normalizeEmailList([
    ...(order.notificationEmails || []),
    order.customerEmail,
  ]);

  return emails.length > 0 ? emails : [normalizeEmail(order.customerEmail)];
}

function cleanChoiceLabel(value: string) {
  return value.replaceAll(SELECTION_META_SEPARATOR, " — ");
}

function formatOrderStatusLabel(status: OrderStatus) {
  return status.replaceAll("_", " ");
}

function getStatusEmailType(status: OrderStatus) {
  if (status === "COMPLETED") {
    return "completed";
  }

  if (status === "SENT_TO_FACTORY") {
    return "sent_to_factory";
  }

  return "updated";
}

function getStatusEmailSubject(status: OrderStatus, orderNumber: string) {
  if (status === "COMPLETED") {
    return `Your order is completed: ${orderNumber}`;
  }

  if (status === "SENT_TO_FACTORY") {
    return `Your order was sent to the factory: ${orderNumber}`;
  }

  return `Your order status was updated: ${orderNumber}`;
}

function buildSnapshotProductName(order: {
  items: {
    productNameSnapshot: string;
  }[];
}) {
  const productNames = Array.from(
    new Set(
      order.items
        .map((item) => item.productNameSnapshot)
        .filter(Boolean)
    )
  );

  return productNames.join(", ") || "Order";
}

function buildSnapshotLineItems(order: {
  items: {
    productNameSnapshot: string;
    basePriceSnapshot: unknown;
    selections: {
      optionGroupNameSnapshot: string;
      optionChoiceNameSnapshot: string;
      priceDeltaSnapshot: unknown;
    }[];
  }[];
}) {
  return order.items.flatMap((item) => [
    {
      label: `${item.productNameSnapshot} Base Price`,
      amount: Number(item.basePriceSnapshot || 0),
    },
    ...item.selections.map((selection) => ({
      label: `${selection.optionGroupNameSnapshot}: ${cleanChoiceLabel(
        selection.optionChoiceNameSnapshot
      )}`,
      amount: Number(selection.priceDeltaSnapshot || 0),
    })),
  ]);
}

function buildSnapshotSelections(order: {
  items: {
    selections: {
      optionGroupNameSnapshot: string;
      optionChoiceNameSnapshot: string;
      optionChoiceImageUrlSnapshot: string | null;
      leatherNameSnapshot: string | null;
      leatherGradeSnapshot: string | null;
      leatherImageUrlSnapshot: string | null;
      laseredBrandImageUrlSnapshot: string | null;
      priceDeltaSnapshot: unknown;
    }[];
  }[];
}) {
  return order.items.flatMap((item) =>
    item.selections.map((selection) => ({
      groupName: selection.optionGroupNameSnapshot,
      choiceLabel: cleanChoiceLabel(selection.optionChoiceNameSnapshot),
      leatherName: selection.leatherNameSnapshot || null,
      leatherGrade: selection.leatherGradeSnapshot || null,
      baseAmount: Number(selection.priceDeltaSnapshot || 0),
      leatherSurcharge: 0,
      imageUrl: selection.optionChoiceImageUrlSnapshot || null,
      leatherImageUrl: selection.leatherImageUrlSnapshot || null,
      laseredBrand: Boolean(selection.laseredBrandImageUrlSnapshot),
      laseredBrandImageUrl: selection.laseredBrandImageUrlSnapshot || null,
      isBodyLeather: false,
    }))
  );
}

function normalizeText(value?: string | null) {
  return String(value || "").trim().toLowerCase();
}

function getActiveQuickPickGroupName(
  groups: {
    name: string;
    choices: {
      label: string;
      usesLeatherGrades: boolean;
      isQuickPick: boolean;
    }[];
  }[],
  selections: IncomingSelection[]
) {
  for (const group of groups) {
    const groupSelections = selections.filter(
      (selection) =>
        normalizeText(selection.groupName) === normalizeText(group.name)
    );

    for (const selection of groupSelections) {
      const matchingChoice = group.choices.find(
        (choice) =>
          normalizeText(choice.label) === normalizeText(selection.choiceLabel)
      );

      if (matchingChoice?.isQuickPick) {
        return group.name;
      }
    }
  }

  return null;
}

function isApiGroupLockedByQuickPick(
  group: {
    name: string;
    choices: {
      usesLeatherGrades: boolean;
    }[];
  },
  activeQuickPickGroupName: string | null
) {
  return (
    Boolean(activeQuickPickGroupName) &&
    normalizeText(group.name) !== normalizeText(activeQuickPickGroupName) &&
    group.choices.some((choice) => choice.usesLeatherGrades)
  );
}

function getRequiredValidationMessages(
  groups: {
    name: string;
    required: boolean;
    choices: {
      label: string;
      usesLeatherGrades: boolean;
      isQuickPick: boolean;
    }[];
  }[],
  selections: IncomingSelection[]
) {
  const messages: string[] = [];
  const activeQuickPickGroupName = getActiveQuickPickGroupName(
    groups,
    selections
  );

  for (const group of groups) {
    if (!group.required) continue;

    if (isApiGroupLockedByQuickPick(group, activeQuickPickGroupName)) {
      continue;
    }

    const groupSelections = selections.filter(
      (selection) =>
        normalizeText(selection.groupName) === normalizeText(group.name)
    );

    if (groupSelections.length === 0) {
      messages.push(`Please complete required option: ${group.name}.`);
      continue;
    }

    for (const selection of groupSelections) {
      const matchingChoice = group.choices.find(
        (choice) =>
          normalizeText(choice.label) === normalizeText(selection.choiceLabel)
      );

      if (!matchingChoice) continue;

      if (matchingChoice.usesLeatherGrades && !selection.leatherName) {
        messages.push(
          `Please choose leather for: ${group.name} - ${matchingChoice.label}.`
        );
      }
    }
  }

  return messages;
}

function getMissingRequiredGroups(
  requiredGroups: { name: string }[],
  selections: IncomingSelection[]
) {
  const selectedGroupNames = new Set(
    selections.map((selection) => normalizeText(selection.groupName || ""))
  );

  return requiredGroups
    .filter((group) => !selectedGroupNames.has(normalizeText(group.name)))
    .map((group) => group.name);
}


function isAdminEmail(email?: string | null) {
  if (!email) return false;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizePriority(
  value: unknown,
  fallback: OrderPriority
): OrderPriority {
  const raw = String(value || "").trim().toUpperCase();

  if (raw === "HOT") {
    return "HOLD";
  }

  if (ORDER_PRIORITIES.has(raw as OrderPriority)) {
    return raw as OrderPriority;
  }

  return fallback;
}

function parseOptionalDate(value: unknown) {
  const raw = String(value || "").trim();

  if (!raw) {
    return { raw, date: null as Date | null };
  }

  const date = new Date(raw);

  return {
    raw,
    date: Number.isNaN(date.getTime()) ? null : date,
  };
}

function roundToTwo(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

async function enrichSelectionsWithLeatherUsage(
  productId: string,
  selections: IncomingSelection[]
): Promise<ResolvedSelection[]> {
  const groups = await prisma.optionGroup.findMany({
    where: { productId },
    select: {
      name: true,
      choices: {
        select: {
          label: true,
          leatherInventoryUsage: true,
        },
      },
    },
  });

  const usageMap = new Map<string, number>();

  for (const group of groups) {
    for (const choice of group.choices) {
      usageMap.set(
        `${group.name}|||${choice.label}`,
        Number(choice.leatherInventoryUsage || 0)
      );
    }
  }

  return selections.map((selection) => ({
    ...selection,
    leatherInventoryUsage: Number(
      selection.leatherInventoryUsage ??
        usageMap.get(`${selection.groupName}|||${selection.choiceLabel}`) ??
        0
    ),
  }));
}

function buildSelectionRows(selections: ResolvedSelection[]) {
  const rows: Array<{
    optionGroupNameSnapshot: string;
    optionChoiceNameSnapshot: string;
    optionChoiceImageUrlSnapshot: string | null;
    leatherNameSnapshot: string | null;
    leatherGradeSnapshot: string | null;
    leatherImageUrlSnapshot: string | null;
    laseredBrandImageUrlSnapshot: string | null;
    priceDeltaSnapshot: number;
    leatherInventoryUsageSnapshot: number | null;
  }> = [];

  for (const selection of selections) {
    rows.push({
      optionGroupNameSnapshot: selection.groupName,
      optionChoiceNameSnapshot: selection.choiceLabel,
      optionChoiceImageUrlSnapshot: selection.imageUrl || null,
      leatherNameSnapshot: null,
      leatherGradeSnapshot: null,
      leatherImageUrlSnapshot: null,
      laseredBrandImageUrlSnapshot: null,
      priceDeltaSnapshot: Number(selection.baseAmount || 0),
      leatherInventoryUsageSnapshot: Number(
        selection.leatherInventoryUsage || 0
      ),
    });

    if (selection.leatherName) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Leather`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.leatherName}${
          selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
        }`,
        optionChoiceImageUrlSnapshot: null,
        leatherNameSnapshot: selection.leatherName || null,
        leatherGradeSnapshot: selection.leatherGrade || null,
        leatherImageUrlSnapshot: selection.leatherImageUrl || null,
        laseredBrandImageUrlSnapshot: null,
        priceDeltaSnapshot: Number(selection.leatherSurcharge || 0),
        leatherInventoryUsageSnapshot: null,
      });
    }

if (selection.laseredBrand) {
  rows.push({
    optionGroupNameSnapshot: `${selection.groupName} Lasered Brand`,
    optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}Yes`,
    optionChoiceImageUrlSnapshot: null,
    leatherNameSnapshot: null,
    leatherGradeSnapshot: null,
    leatherImageUrlSnapshot: null,
    laseredBrandImageUrlSnapshot: selection.laseredBrandImageUrl || null,
    priceDeltaSnapshot: Number(selection.laseredBrandSurcharge || 0),
    leatherInventoryUsageSnapshot: null,
  });
}

    if (selection.laseredBrandImageUrl) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand Image`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.laseredBrandImageUrl}`,
        optionChoiceImageUrlSnapshot: null,
        leatherNameSnapshot: null,
        leatherGradeSnapshot: null,
        leatherImageUrlSnapshot: null,
        laseredBrandImageUrlSnapshot: selection.laseredBrandImageUrl || null,
        priceDeltaSnapshot: 0,
        leatherInventoryUsageSnapshot: null,
      });
    }
  }

  return rows;
}

function buildBodyLeather(selections: ResolvedSelection[]) {
  const uniqueValues = new Set<string>();

  for (const selection of selections) {
    if (!selection.isBodyLeather || !selection.leatherName) {
      continue;
    }

    const leatherValue = `${selection.leatherName}${
      selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
    }`.trim();

    if (leatherValue) {
      uniqueValues.add(leatherValue);
    }
  }

  return Array.from(uniqueValues).join(", ");
}

function buildProductionLines(
  selections: ResolvedSelection[],
  productNameSnapshot: string,
  quantity: number,
  bodyLeather: string | null,
  dueDate: Date | null,
  priority: OrderPriority
) {
  const seen = new Map<string, ProductionLineSeed>();

  for (const selection of selections) {
    const partNumber = String(
      selection.partNumber || selection.choiceValue || ""
    ).trim();
    const frameNeeded = String(selection.frameNeededCode || "").trim();

    if (!partNumber || !frameNeeded) {
      continue;
    }

    const key = `${partNumber}|||${frameNeeded}`;

    if (!seen.has(key)) {
      seen.set(key, {
        productNameSnapshot,
        optionGroupNameSnapshot: selection.groupName || null,
        optionChoiceNameSnapshot: selection.choiceLabel || null,
        partNumber,
        frameNeeded,
        quantity,
        bodyLeather,
        dueDate,
        priority,
      });
    }
  }

  return Array.from(seen.values());
}

function buildLeatherInventoryDeltas(
  selections: ResolvedSelection[],
  orderQuantity: number
): LeatherInventoryDelta[] {
  const grouped = new Map<string, number>();

  for (const selection of selections) {
    const leatherName = String(selection.leatherName || "").trim();
    const usage = Number(selection.leatherInventoryUsage || 0);

    if (!leatherName || usage <= 0) {
      continue;
    }

    grouped.set(
      leatherName,
      roundToTwo((grouped.get(leatherName) || 0) + usage * orderQuantity)
    );
  }

  return Array.from(grouped.entries()).map(([leatherName, units]) => ({
    leatherName,
    units,
  }));
}

function buildLeatherInventoryDiff(
  previousDeltas: LeatherInventoryDelta[],
  nextDeltas: LeatherInventoryDelta[]
): LeatherInventoryDelta[] {
  const grouped = new Map<string, number>();

  for (const delta of previousDeltas) {
    grouped.set(
      delta.leatherName,
      roundToTwo((grouped.get(delta.leatherName) || 0) - delta.units)
    );
  }

  for (const delta of nextDeltas) {
    grouped.set(
      delta.leatherName,
      roundToTwo((grouped.get(delta.leatherName) || 0) + delta.units)
    );
  }

  return Array.from(grouped.entries())
    .filter(([, units]) => units !== 0)
    .map(([leatherName, units]) => ({
      leatherName,
      units,
    }));
}

async function applyLeatherInventoryDeltas(
  tx: Prisma.TransactionClient,
  deltas: LeatherInventoryDelta[]
) {
  if (deltas.length === 0) {
    return;
  }

  const leathers = await tx.leather.findMany({
    select: {
      id: true,
      name: true,
    },
  });

  const leatherMap = new Map(
    leathers.map((leather) => [leather.name.trim().toLowerCase(), leather])
  );

  for (const delta of deltas) {
    const leather = leatherMap.get(delta.leatherName.trim().toLowerCase());

    if (!leather || !delta.units) {
      continue;
    }

    if (delta.units > 0) {
      await tx.leather.update({
        where: { id: leather.id },
        data: {
          inventoryUnits: {
            decrement: delta.units,
          },
        },
      });
    } else {
      await tx.leather.update({
        where: { id: leather.id },
        data: {
          inventoryUnits: {
            increment: Math.abs(delta.units),
          },
        },
      });
    }
  }
}

function extractLatestRevisionSnapshot(afterJson: unknown): RevisionSelectionSnapshot {
  if (!afterJson || typeof afterJson !== "object") {
    return {
      selections: [],
      quantity: 1,
    };
  }

  const parsed = afterJson as {
    selections?: unknown;
    quantity?: unknown;
  };

  const quantity = sanitizeQuantity(
    typeof parsed.quantity === "number"
      ? parsed.quantity
      : Number(parsed.quantity ?? 1)
  );

  if (!Array.isArray(parsed.selections)) {
    return {
      selections: [],
      quantity,
    };
  }

  const selections = parsed.selections
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const selection = item as IncomingSelection;

      if (
        typeof selection.groupName !== "string" ||
        typeof selection.choiceLabel !== "string"
      ) {
        return null;
      }

      return {
        groupName: selection.groupName,
        choiceLabel: selection.choiceLabel,
        choiceValue:
          typeof selection.choiceValue === "string" ? selection.choiceValue : null,
        partNumber:
          typeof selection.partNumber === "string" ? selection.partNumber : null,
        leatherName:
          typeof selection.leatherName === "string" ? selection.leatherName : null,
        leatherGrade:
          typeof selection.leatherGrade === "string"
            ? selection.leatherGrade
            : null,
        baseAmount: Number(selection.baseAmount || 0),
        leatherSurcharge: Number(selection.leatherSurcharge || 0),
        imageUrl:
          typeof selection.imageUrl === "string" ? selection.imageUrl : null,
        leatherImageUrl:
          typeof selection.leatherImageUrl === "string"
            ? selection.leatherImageUrl
            : null,
laseredBrand: Boolean(selection.laseredBrand),
laseredBrandSurcharge: Number(selection.laseredBrandSurcharge || 0),
laseredBrandImageUrl:
          typeof selection.laseredBrandImageUrl === "string"
            ? selection.laseredBrandImageUrl
            : null,
        quantity: sanitizeQuantity(
          typeof selection.quantity === "number"
            ? selection.quantity
            : Number(selection.quantity || 1)
        ),
        frameNeededCode:
          typeof selection.frameNeededCode === "string"
            ? selection.frameNeededCode
            : null,
        isBodyLeather: Boolean(selection.isBodyLeather),
        leatherInventoryUsage: Number(selection.leatherInventoryUsage || 0),
      } satisfies IncomingSelection;
    })
    .filter(Boolean) as IncomingSelection[];

  return {
    selections,
    quantity,
  };
}

export async function PUT(request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to edit an order." },
        { status: 401 }
      );
    }

    const viewerEmail = normalizeEmail(session.user.email);
    const viewerUser = await prisma.user.findUnique({
      where: { email: viewerEmail },
      select: { id: true },
    });

    const { id } = await context.params;
    const body = await request.json();

    const isAdminUser = isAdminEmail(viewerEmail);
    const adminUpdate = body.adminUpdate === true && isAdminUser;

    const requestedStatus =
      typeof body.status === "string" ? body.status.trim() : "";

    const rawSelections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    const statusOnlyUpdate =
      requestedStatus.length > 0 && rawSelections.length === 0;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            selections: true,
          },
        },
        revisions: {
          orderBy: { revisionNumber: "desc" },
          take: 1,
        },
        productionLines: true,
      },
    });

    if (!order || order.items.length === 0) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isSubmitter =
      Boolean(order.userId) &&
      Boolean(viewerUser?.id) &&
      order.userId === viewerUser?.id;

    const isCustomer = normalizeEmail(order.customerEmail) === viewerEmail;

    const allowed = isSubmitter || isCustomer || isAdminUser;

    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to edit this order." },
        { status: 403 }
      );
    }

    const allowedStatuses: OrderStatus[] = [
      "DRAFT",
      "SUBMITTED",
      "CHANGED",
      "SENT_TO_FACTORY",
      "COMPLETED",
      "PAID",
      "CANCELLED",
    ];

    if (statusOnlyUpdate || adminUpdate) {
      if (!isAdminUser) {
        return NextResponse.json(
          { error: "Only admins can update order status directly." },
          { status: 403 }
        );
      }

      const nextAdminStatus =
        requestedStatus.length > 0
          ? (requestedStatus as OrderStatus)
          : order.status;

      if (!allowedStatuses.includes(nextAdminStatus)) {
        return NextResponse.json(
          { error: "Invalid order status." },
          { status: 400 }
        );
      }

      const adminCustomerName =
        String(body.customerName || "").trim() || order.customerName;

      const adminCustomerEmail = String(body.customerEmail || "").trim()
        ? normalizeEmail(String(body.customerEmail))
        : order.customerEmail;
      
      const requestedAdminNotificationEmails =
  body.notificationEmails === undefined
    ? getOrderNotificationEmails(order)
    : normalizeEmailList(body.notificationEmails);

const adminNotificationEmails = normalizeEmailList([
  adminCustomerEmail,
  ...requestedAdminNotificationEmails,
]);

const invalidAdminNotificationEmails = getInvalidEmails(
  adminNotificationEmails
);

if (invalidAdminNotificationEmails.length > 0) {
  return NextResponse.json(
    {
      error: `Invalid email address: ${invalidAdminNotificationEmails.join(
        ", "
      )}`,
    },
    { status: 400 }
  );
}

      const adminCustomerPhone =
        body.customerPhone === undefined
          ? order.customerPhone
          : String(body.customerPhone || "").trim() || null;

      const adminNotes =
        body.notes === undefined
          ? order.notes
          : String(body.notes || "").trim() || null;

      const changeReason =
        String(body.changeReason || "").trim() || "Admin order update";

      const nextRevisionNumber =
        order.revisions.length > 0 ? order.revisions[0].revisionNumber + 1 : 1;

      const [updatedOrder] = await prisma.$transaction([
        prisma.order.update({
          where: { id },
          data: {
            customerName: adminCustomerName,
            customerEmail: adminCustomerEmail,
            notificationEmails: adminNotificationEmails,
            customerPhone: adminCustomerPhone,
            notes: adminNotes,
            status: nextAdminStatus,
          },
        }),
        prisma.orderRevision.create({
          data: {
            orderId: id,
            revisionNumber: nextRevisionNumber,
            changedBy: viewerEmail,
            changeReason,
            beforeJson: {
              status: order.status,
              customerName: order.customerName,
              customerEmail: order.customerEmail,
              notificationEmails: getOrderNotificationEmails(order),
              customerPhone: order.customerPhone,
              notes: order.notes,
              poNumber: order.poNumber,
              quantity: order.quantity,
              priority: order.priority,
              dueDate: order.dueDate,
            },
            afterJson: {
              status: nextAdminStatus,
              customerName: adminCustomerName,
              customerEmail: adminCustomerEmail,
              notificationEmails: adminNotificationEmails,
              customerPhone: adminCustomerPhone,
              notes: adminNotes,
              poNumber: order.poNumber,
              quantity: order.quantity,
              priority: order.priority,
              dueDate: order.dueDate,
            },
          },
        }),
      ]);

const adminStatusChanged = order.status !== nextAdminStatus;

if (adminStatusChanged) {
  const emailType = getStatusEmailType(nextAdminStatus);
  const customerSubject = getStatusEmailSubject(
    nextAdminStatus,
    updatedOrder.orderNumber
  );

  const internalSubject =
    emailType === "completed"
      ? `Order Completed: ${updatedOrder.orderNumber}`
      : emailType === "sent_to_factory"
      ? `Order Sent to Factory: ${updatedOrder.orderNumber}`
      : `Order Status Updated: ${updatedOrder.orderNumber}`;

  const statusMessage = `Order status changed from ${formatOrderStatusLabel(
    order.status
  )} to ${formatOrderStatusLabel(nextAdminStatus)}.`;

  const emailNotes = [statusMessage, adminNotes ? `Order notes: ${adminNotes}` : ""]
    .filter(Boolean)
    .join("\n\n");

  try {
    await sendOrderNotification({
      type: emailType,
      orderNumber: updatedOrder.orderNumber,
      poNumber: updatedOrder.poNumber,
      quantity: updatedOrder.quantity,
      customerName: updatedOrder.customerName,
      customerEmail: updatedOrder.customerEmail,
      recipientEmails: adminNotificationEmails,
      customerPhone: updatedOrder.customerPhone,
      notes: emailNotes,
      notesImageUrl: updatedOrder.notesImageUrl,
      productName: buildSnapshotProductName(order),
      total: Number(updatedOrder.total || 0),
      lineItems: buildSnapshotLineItems(order),
      selections: buildSnapshotSelections(order),
    });

    await prisma.emailLog.createMany({
      data: [
        ...adminNotificationEmails.map((recipient) => ({
          orderId: id,
          eventType:
            emailType === "completed"
              ? "ORDER_COMPLETED_CUSTOMER"
              : emailType === "sent_to_factory"
              ? "ORDER_SENT_TO_FACTORY_CUSTOMER"
              : "ORDER_STATUS_UPDATED_CUSTOMER",
          recipient,
          subject: customerSubject,
          status: "SENT",
        })),
        {
          orderId: id,
          eventType:
            emailType === "completed"
              ? "ORDER_COMPLETED_INTERNAL"
              : emailType === "sent_to_factory"
              ? "ORDER_SENT_TO_FACTORY_INTERNAL"
              : "ORDER_STATUS_UPDATED_INTERNAL",
          recipient: process.env.ORDER_NOTIFY_TO || "",
          subject: internalSubject,
          status: "SENT",
        },
      ],
    });
  } catch (error) {
    console.error("ADMIN STATUS EMAIL ERROR:", error);

    await prisma.emailLog.create({
      data: {
        orderId: id,
        eventType: "ORDER_STATUS_UPDATED",
        recipient:
          adminNotificationEmails.join(", ") || updatedOrder.customerEmail,
        subject: customerSubject,
        status: "FAILED",
        errorMessage:
          error instanceof Error ? error.message : "Unknown email error",
      },
    });
  }
}

return NextResponse.json(updatedOrder);
    }

    if (rawSelections.length === 0) {
      return NextResponse.json(
        { error: "At least one selection is required." },
        { status: 400 }
      );
    }

    const poNumber = String(body.poNumber || "").trim();

    if (!poNumber) {
      return NextResponse.json(
        { error: "PO # is required." },
        { status: 400 }
      );
    }

    const customerPhone = String(body.customerPhone || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const notesImageUrl = String(body.notesImageUrl || "").trim() || null;
    const changeReason =
      String(body.changeReason || "").trim() || "Order updated";
    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);

    const approvedCustomer = await getApprovedCustomerProfile(viewerEmail);

    if (isCustomer && !approvedCustomer) {
      return NextResponse.json(
        { error: "This email is not approved to edit customer orders." },
        { status: 403 }
      );
    }

    const customerName = order.customerName;
    const customerEmail = normalizeEmail(order.customerEmail);
    const notificationEmails = getOrderNotificationEmails(order);

    const item = order.items[0];

const requiredGroups = await prisma.optionGroup.findMany({
  where: {
    productId: item.productId,
    active: true,
  },
  select: {
    name: true,
    required: true,
    choices: {
      where: {
        active: true,
      },
      select: {
        label: true,
        usesLeatherGrades: true,
        isQuickPick: true,
      },
    },
  },
});

const requiredValidationMessages = getRequiredValidationMessages(
  requiredGroups,
  rawSelections
);

if (requiredValidationMessages.length > 0) {
  return NextResponse.json(
    { error: requiredValidationMessages.join(" ") },
    { status: 400 }
  );
}

    const quantity = sanitizeQuantity(
      Number(
        body.quantity ??
          body.orderQuantity ??
          body.selections?.[0]?.quantity ??
          order.quantity ??
          1
      )
    );

    const priority = normalizePriority(
      body.priority,
      order.priority as OrderPriority
    );

    const dueDateInput = parseOptionalDate(body.dueDate);
    const dueDate = dueDateInput.raw === "" ? order.dueDate : dueDateInput.date;

    if (dueDateInput.raw && !dueDateInput.date) {
      return NextResponse.json(
        { error: "Due date is invalid." },
        { status: 400 }
      );
    }

    const selections = await enrichSelectionsWithLeatherUsage(
      item.productId,
      rawSelections
    );

    const selectionRows = buildSelectionRows(selections);

    const nextRevisionNumber =
      order.revisions.length > 0 ? order.revisions[0].revisionNumber + 1 : 1;

    const nextStatus = order.status === "DRAFT" ? "DRAFT" : "CHANGED";

    const bodyLeather = buildBodyLeather(selections) || null;

    const nextProductionLines = buildProductionLines(
      selections,
      productName || item.productNameSnapshot,
      quantity,
      bodyLeather,
      dueDate,
      priority
    );

    const previousRevisionSnapshot = extractLatestRevisionSnapshot(
      order.revisions[0]?.afterJson
    );

    const previousSelections = await enrichSelectionsWithLeatherUsage(
      item.productId,
      previousRevisionSnapshot.selections
    );

    const shouldAdjustLeatherInventory =
      order.status === "SENT_TO_FACTORY" ||
      order.status === "COMPLETED" ||
      order.productionLines.length > 0;

    const previousLeatherInventoryDeltas = shouldAdjustLeatherInventory
      ? buildLeatherInventoryDeltas(
          previousSelections,
          previousRevisionSnapshot.quantity || order.quantity
        )
      : [];

    const nextLeatherInventoryDeltas = shouldAdjustLeatherInventory
      ? buildLeatherInventoryDeltas(selections, quantity)
      : [];

    const leatherInventoryDiff = shouldAdjustLeatherInventory
      ? buildLeatherInventoryDiff(
          previousLeatherInventoryDeltas,
          nextLeatherInventoryDeltas
        )
      : [];

    await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: {
          poNumber,
          customerName,
          customerEmail,
          customerPhone,
          notes,
          notesImageUrl,
          total,
          subtotal: total,
          quantity,
          dueDate,
          priority,
          status: nextStatus,
          items: {
            update: {
              where: { id: item.id },
              data: {
                productNameSnapshot: productName || item.productNameSnapshot,
                basePriceSnapshot: basePrice,
                quantity,
                lineTotal: total,
                selections: {
                  deleteMany: {},
                  create: selectionRows,
                },
              },
            },
          },
        },
      }),
      prisma.orderRevision.create({
        data: {
          orderId: id,
          revisionNumber: nextRevisionNumber,
          changedBy: viewerEmail,
          changeReason,
          beforeJson: {
            status: order.status,
            notesImageUrl: order.notesImageUrl,
            poNumber: order.poNumber,
            quantity: order.quantity,
            priority: order.priority,
            dueDate: order.dueDate,
          },
          afterJson: {
            status: nextStatus,
            poNumber,
            quantity,
            notesImageUrl,
            priority,
            dueDate,
            selections,
            lineItems,
          },
        },
      }),
    ]);

    if (order.productionLines.length > 0) {
      const previousMap = new Map(
        order.productionLines.map((line) => [
          `${line.partNumber}|||${line.frameNeeded}`,
          line,
        ])
      );

      const nextMap = new Map(
        nextProductionLines.map((line) => [
          `${line.partNumber}|||${line.frameNeeded}`,
          line,
        ])
      );

      const ledgerChanges: Array<{
        partNumber: string;
        frameNeeded: string;
        qtyChange: number;
      }> = [];

      const tx: Prisma.PrismaPromise<unknown>[] = [];

      for (const previousLine of order.productionLines) {
        const key = `${previousLine.partNumber}|||${previousLine.frameNeeded}`;

        if (!nextMap.has(key)) {
          tx.push(
            prisma.productionLine.delete({
              where: { id: previousLine.id },
            })
          );

          ledgerChanges.push({
            partNumber: previousLine.partNumber,
            frameNeeded: previousLine.frameNeeded,
            qtyChange: -previousLine.quantity,
          });
        }
      }

      for (const nextLine of nextProductionLines) {
        const key = `${nextLine.partNumber}|||${nextLine.frameNeeded}`;
        const previousLine = previousMap.get(key);

        if (!previousLine) {
          tx.push(
            prisma.productionLine.create({
              data: {
                orderId: id,
                ...nextLine,
              },
            })
          );

          ledgerChanges.push({
            partNumber: nextLine.partNumber,
            frameNeeded: nextLine.frameNeeded,
            qtyChange: nextLine.quantity,
          });

          continue;
        }

        tx.push(
          prisma.productionLine.update({
            where: { id: previousLine.id },
            data: {
              productNameSnapshot: nextLine.productNameSnapshot,
              optionGroupNameSnapshot: nextLine.optionGroupNameSnapshot,
              optionChoiceNameSnapshot: nextLine.optionChoiceNameSnapshot,
              quantity: nextLine.quantity,
              bodyLeather: nextLine.bodyLeather,
              dueDate: nextLine.dueDate,
              priority: nextLine.priority,
            },
          })
        );

        const diff = nextLine.quantity - previousLine.quantity;

        if (diff !== 0) {
          ledgerChanges.push({
            partNumber: nextLine.partNumber,
            frameNeeded: nextLine.frameNeeded,
            qtyChange: diff,
          });
        }
      }

      if (ledgerChanges.length > 0) {
        tx.push(
          prisma.quantityLedger.createMany({
            data: ledgerChanges.map((change) => ({
              orderId: id,
              orderNumber: order.orderNumber,
              poNumber,
              customerName,
              partNumber: change.partNumber,
              frameNeeded: change.frameNeeded,
              qtyChange: change.qtyChange,
              reason: "ORDER_EDITED",
              source: "website-edit",
            })),
          })
        );
      }

      if (tx.length > 0) {
        await prisma.$transaction(tx);
      }
    }

    if (shouldAdjustLeatherInventory && leatherInventoryDiff.length > 0) {
      await prisma.$transaction(async (tx) => {
        await applyLeatherInventoryDeltas(tx, leatherInventoryDiff);
      });
    }

    try {
      await sendOrderNotification({
        type: "updated",
        orderNumber: order.orderNumber,
        poNumber,
        quantity,
        customerName,
        customerEmail,
        recipientEmails: notificationEmails,
        customerPhone,
        notes,
        notesImageUrl,
        productName: productName || item.productNameSnapshot,
        total,
        lineItems,
        selections: selections.map((selection: ResolvedSelection) => ({
          groupName: selection.groupName,
          choiceLabel: selection.choiceLabel,
          leatherName: selection.leatherName || null,
          leatherGrade: selection.leatherGrade || null,
          baseAmount: Number(selection.baseAmount || 0),
          leatherSurcharge: Number(selection.leatherSurcharge || 0),
          imageUrl: selection.imageUrl || null,
          leatherImageUrl: selection.leatherImageUrl || null,
          laseredBrand: Boolean(selection.laseredBrand),
          laseredBrandImageUrl: selection.laseredBrandImageUrl || null,
          isBodyLeather: Boolean(selection.isBodyLeather),
        })),
      });

      await prisma.emailLog.createMany({
        data: [
...notificationEmails.map((recipient) => ({
  orderId: id,
  eventType: "ORDER_UPDATED_CUSTOMER",
  recipient,
  subject: `Your order was updated: ${order.orderNumber}`,
  status: "SENT",
})),
          {
            orderId: id,
            eventType: "ORDER_UPDATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: `Order Updated: ${order.orderNumber}`,
            status: "SENT",
          },
        ],
      });
    } catch (error) {
      console.error("UPDATE ORDER EMAIL ERROR:", error);

      await prisma.emailLog.create({
        data: {
          orderId: id,
          eventType: "ORDER_UPDATED",
recipient: notificationEmails.join(", ") || customerEmail,
          subject: `Your order was updated: ${order.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            selections: true,
          },
        },
        revisions: {
          orderBy: { createdAt: "desc" },
        },
        emailLogs: {
          orderBy: { createdAt: "desc" },
        },
        sheetSyncLogs: {
          orderBy: { createdAt: "desc" },
        },
        productionLines: {
          orderBy: [{ partNumber: "asc" }, { frameNeeded: "asc" }],
        },
      },
    });

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 }
    );
  }
}