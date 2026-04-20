import { NextResponse } from "next/server";
import { auth } from "../../../../auth";
import { prisma } from "../../../../lib/prisma";
import { sendOrderNotification } from "../../../../lib/email";
import { appendOrderRow } from "../../../../lib/sheets";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

type IncomingSelection = {
  groupName: string;
  choiceLabel: string;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount: number;
  leatherSurcharge: number;
  imageUrl?: string | null;
  leatherImageUrl?: string | null;
  laseredBrand?: boolean;
  laseredBrandImageUrl?: string | null;
};

type IncomingLineItem = {
  label: string;
  amount: number;
};

const SELECTION_META_SEPARATOR = "|||";

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function isValidEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isAdminEmail(email?: string | null) {
  if (!email) return false;

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.toLowerCase());
}

function buildSelectionRows(selections: IncomingSelection[]) {
  return selections.flatMap((selection: IncomingSelection) => {
    const rows = [
      {
        optionGroupNameSnapshot: selection.groupName,
        optionChoiceNameSnapshot: selection.choiceLabel,
        priceDeltaSnapshot: Number(selection.baseAmount || 0),
      },
    ];

    if (selection.leatherName) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Leather`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.leatherName}${
          selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
        }`,
        priceDeltaSnapshot: Number(selection.leatherSurcharge || 0),
      });
    }

    if (selection.laseredBrand) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}Yes`,
        priceDeltaSnapshot: 0,
      });
    }

    if (selection.laseredBrandImageUrl) {
      rows.push({
        optionGroupNameSnapshot: `${selection.groupName} Lasered Brand Image`,
        optionChoiceNameSnapshot: `${selection.choiceLabel}${SELECTION_META_SEPARATOR}${selection.laseredBrandImageUrl}`,
        priceDeltaSnapshot: 0,
      });
    }

    return rows;
  });
}

function buildSelectionsText(selections: IncomingSelection[]) {
  return selections
    .map((selection: IncomingSelection) => {
      const lines = [`${selection.groupName}: ${selection.choiceLabel}`];

      if (selection.leatherName) {
        lines.push(
          `Leather: ${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`
        );
      }

      if (selection.laseredBrand) {
        lines.push("Lasered Brand: Yes");
      }

      return lines.join(" | ");
    })
    .join(" || ");
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in." },
        { status: 401 }
      );
    }

    const viewerEmail = normalizeEmail(session.user.email);
    const { id } = await context.params;

    const viewerUser = await prisma.user.findUnique({
      where: { email: viewerEmail },
      select: { id: true },
    });

    const order = await prisma.order.findUnique({
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
      },
    });

    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const isSubmitter =
      Boolean(order.userId) &&
      Boolean(viewerUser?.id) &&
      order.userId === viewerUser?.id;

    const isCustomer = normalizeEmail(order.customerEmail) === viewerEmail;

    const allowed = isSubmitter || isCustomer || isAdminEmail(viewerEmail);

    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to view this order." },
        { status: 403 }
      );
    }

    return NextResponse.json(order);
  } catch (error) {
    console.error("GET ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to fetch order." },
      { status: 500 }
    );
  }
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

    const customerName = String(body.customerName || "").trim();
    const customerEmailRaw = String(body.customerEmail || "").trim();
    const customerEmail = normalizeEmail(customerEmailRaw);
    const customerPhone = String(body.customerPhone || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const changeReason = String(body.changeReason || "").trim() || "Order updated";
    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!customerEmail || !isValidEmail(customerEmail)) {
      return NextResponse.json(
        { error: "A valid customer email is required." },
        { status: 400 }
      );
    }

    if (selections.length === 0) {
      return NextResponse.json(
        { error: "At least one selection is required." },
        { status: 400 }
      );
    }

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

    const allowed = isSubmitter || isCustomer || isAdminEmail(viewerEmail);

    if (!allowed) {
      return NextResponse.json(
        { error: "You are not allowed to edit this order." },
        { status: 403 }
      );
    }

    const item = order.items[0];
    const selectionRows = buildSelectionRows(selections);
    const nextRevisionNumber =
      order.revisions.length > 0 ? order.revisions[0].revisionNumber + 1 : 1;
    const nextStatus = order.status === "DRAFT" ? "DRAFT" : "CHANGED";

    const [updatedOrder] = await prisma.$transaction([
      prisma.order.update({
        where: { id },
        data: {
          customerName,
          customerEmail,
          customerPhone,
          notes,
          total,
          status: nextStatus,
          items: {
            update: {
              where: { id: item.id },
              data: {
                productNameSnapshot: productName || item.productNameSnapshot,
                basePriceSnapshot: basePrice,
                lineTotal: total,
                selections: {
                  deleteMany: {},
                  create: selectionRows,
                },
              },
            },
          },
        },
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
          },
          afterJson: {
            status: nextStatus,
            selections,
            lineItems,
          },
        },
      }),
    ]);

    try {
      await sendOrderNotification({
        type: "updated",
        orderNumber: updatedOrder.orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        productName: productName || item.productNameSnapshot,
        total,
        selections: selections.map((selection: IncomingSelection) => ({
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
        })),
      });

      await prisma.emailLog.createMany({
        data: [
          {
            orderId: id,
            eventType: "ORDER_UPDATED_CUSTOMER",
            recipient: customerEmail,
            subject: `Your order was updated: ${updatedOrder.orderNumber}`,
            status: "SENT",
          },
          {
            orderId: id,
            eventType: "ORDER_UPDATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: `Order Updated: ${updatedOrder.orderNumber}`,
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
          recipient: customerEmail,
          subject: `Your order was updated: ${updatedOrder.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    try {
      await appendOrderRow({
        eventType: "updated",
        orderNumber: updatedOrder.orderNumber,
        status: nextStatus,
        customerName,
        customerEmail,
        customerPhone,
        productName: productName || item.productNameSnapshot,
        total,
        notes,
        selectionsText: buildSelectionsText(selections),
      });

      await prisma.sheetSyncLog.create({
        data: {
          orderId: id,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "APPENDED",
          status: "SYNCED",
        },
      });
    } catch (error) {
      console.error("UPDATE ORDER SHEETS ERROR:", error);

      await prisma.sheetSyncLog.create({
        data: {
          orderId: id,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "APPEND_FAILED",
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown sheets error",
        },
      });
    }

    return NextResponse.json(updatedOrder);
  } catch (error) {
    console.error("UPDATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to update order." },
      { status: 500 }
    );
  }
}