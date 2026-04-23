import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "../../../auth";
import { prisma } from "../../../lib/prisma";
import { sendOrderNotification } from "../../../lib/email";
import { appendOrderRow } from "../../../lib/sheets";

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
  laseredBrandImageUrl?: string | null;
  quantity?: number | null;
  frameNeededCode?: string | null;
  isBodyLeather?: boolean;
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

function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear().toString();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();

  return `FO-${yyyy}${mm}${dd}-${suffix}`;
}

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
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

function buildBodyLeather(selections: IncomingSelection[]) {
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

function buildSheetParts(selections: IncomingSelection[]) {
  const seen = new Set<string>();

  return selections
    .map((selection) => {
      const partNumber = String(
        selection.partNumber || selection.choiceValue || ""
      ).trim();

      const frameNeeded = String(selection.frameNeededCode || "").trim();

      return {
        partNumber,
        frameNeeded,
      };
    })
    .filter((part) => part.partNumber && part.frameNeeded)
    .filter((part) => {
      const key = `${part.partNumber}|||${part.frameNeeded}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });
}

export async function POST(request: Request) {
  try {
    const session = await auth();

    if (!session?.user?.email) {
      return NextResponse.json(
        { error: "You must be signed in to place an order." },
        { status: 401 }
      );
    }

    const body = await request.json();

    const signedInEmail = normalizeEmail(session.user.email);
    const signedInName =
      session.user.name?.trim() || signedInEmail.split("@")[0] || "Customer";

    const productId = String(body.productId || "").trim();
    const poNumber = String(body.poNumber || "").trim() || null;
    const customerName = String(body.customerName || "").trim() || signedInName;
    const customerEmailRaw = String(body.customerEmail || "").trim();
    const customerEmail = normalizeEmail(customerEmailRaw || signedInEmail);
    const customerPhone = String(body.customerPhone || "").trim() || null;
    const notes = String(body.notes || "").trim() || null;
    const productName = String(body.productName || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);
    const submitToFactory = Boolean(body.submitToFactory);
    const quantity = sanitizeQuantity(
      Number(body.quantity ?? body.orderQuantity ?? body.selections?.[0]?.quantity ?? 1)
    );

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    if (!productId) {
      return NextResponse.json(
        { error: "Product is required." },
        { status: 400 }
      );
    }

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

    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: {
        id: true,
        name: true,
        active: true,
      },
    });

    if (!product || !product.active) {
      return NextResponse.json(
        { error: "Product not found." },
        { status: 404 }
      );
    }

    const submittingUser = await prisma.user.findUnique({
      where: { email: signedInEmail },
      select: { id: true },
    });

    const selectionRows = buildSelectionRows(selections);
    const orderNumber = generateOrderNumber();
    const nextStatus = submitToFactory ? "SENT_TO_FACTORY" : "DRAFT";

    const createdOrder = await prisma.order.create({
      data: {
        orderNumber,
        poNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        status: nextStatus,
        total,
        sentToFactoryAt: submitToFactory ? new Date() : null,
        ...(submittingUser?.id ? { userId: submittingUser.id } : {}),
        items: {
          create: [
            {
              productId,
              productNameSnapshot: productName || product.name,
              basePriceSnapshot: basePrice,
              lineTotal: total,
              selections: {
                create: selectionRows,
              },
            },
          ],
        },
        revisions: {
          create: {
            revisionNumber: 1,
            changedBy: signedInEmail,
            changeReason: submitToFactory
              ? "Order created and sent to factory"
              : "Order created",
            beforeJson: Prisma.JsonNull,
            afterJson: {
              status: nextStatus,
              poNumber,
              quantity,
              selections,
              lineItems,
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
    });

    try {
await sendOrderNotification({
  type: submitToFactory ? "sent_to_factory" : "created",
  orderNumber: createdOrder.orderNumber,
  poNumber,
  quantity,
  customerName,
  customerEmail,
  customerPhone,
  notes,
  productName: productName || product.name,
  total,
  lineItems,
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
    isBodyLeather: Boolean(selection.isBodyLeather),
  })),
});

      await prisma.emailLog.createMany({
        data: [
          {
            orderId: createdOrder.id,
            eventType: submitToFactory
              ? "ORDER_SENT_TO_FACTORY_CUSTOMER"
              : "ORDER_CREATED_CUSTOMER",
            recipient: customerEmail,
            subject: submitToFactory
              ? `Your order was sent to the factory: ${createdOrder.orderNumber}`
              : `We received your order draft: ${createdOrder.orderNumber}`,
            status: "SENT",
          },
          {
            orderId: createdOrder.id,
            eventType: submitToFactory
              ? "ORDER_SENT_TO_FACTORY_INTERNAL"
              : "ORDER_CREATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: submitToFactory
              ? `Order Sent to Factory: ${createdOrder.orderNumber}`
              : `New Order Draft: ${createdOrder.orderNumber}`,
            status: "SENT",
          },
        ],
      });
    } catch (error) {
      console.error("ORDER EMAIL ERROR:", error);

      await prisma.emailLog.create({
        data: {
          orderId: createdOrder.id,
          eventType: submitToFactory ? "ORDER_SENT_TO_FACTORY" : "ORDER_CREATED",
          recipient: customerEmail,
          subject: submitToFactory
            ? `Your order was sent to the factory: ${createdOrder.orderNumber}`
            : `We received your order draft: ${createdOrder.orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    if (submitToFactory) {
      try {
        const bodyLeather = buildBodyLeather(selections);
        const parts = buildSheetParts(selections);

        if (parts.length > 0) {
          await appendOrderRow({
            poNumber,
            customerName,
            quantity,
            bodyLeather: bodyLeather || null,
            dateSold: new Date(),
            parts,
          });
        }

        await prisma.sheetSyncLog.create({
          data: {
            orderId: createdOrder.id,
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
            worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
            spreadsheetRowId: parts.length > 0 ? "APPENDED" : "NO_PART_ROWS",
            status: "SYNCED",
          },
        });
      } catch (error) {
        console.error("ORDER SHEETS ERROR:", error);

        await prisma.sheetSyncLog.create({
          data: {
            orderId: createdOrder.id,
            spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
            worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
            spreadsheetRowId: "APPEND_FAILED",
            status: "FAILED",
            errorMessage:
              error instanceof Error ? error.message : "Unknown sheets error",
          },
        });
      }
    }

    return NextResponse.json(createdOrder, { status: 201 });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 }
    );
  }
}