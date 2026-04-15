import { NextResponse } from "next/server";
import { prisma } from "../../../lib/prisma";
import { auth } from "../../../auth";
import { sendOrderNotification } from "../../../lib/email";
import { appendOrderRow } from "../../../lib/sheets";

type IncomingLineItem = {
  label: string;
  amount: number;
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
};

function generateOrderNumber() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const random = Math.floor(1000 + Math.random() * 9000);
  return `ORD-${yyyy}${mm}${dd}-${random}`;
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

      return lines.join(" | ");
    })
    .join(" || ");
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    const userId = session?.user?.id || null;

    const body = await request.json();

    const productId = String(body.productId || "").trim();
    const productName = String(body.productName || "").trim();
    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const notes = String(body.notes || "").trim();
    const basePrice = Number(body.basePrice || 0);
    const total = Number(body.total || 0);
    const submitToFactory = Boolean(body.submitToFactory);

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    if (!productId || !productName) {
      return NextResponse.json(
        { error: "Product information is required." },
        { status: 400 }
      );
    }

    if (!customerName) {
      return NextResponse.json(
        { error: "Customer name is required." },
        { status: 400 }
      );
    }

    if (!customerEmail) {
      return NextResponse.json(
        { error: "Customer email is required." },
        { status: 400 }
      );
    }

    const orderNumber = generateOrderNumber();
    const initialStatus = submitToFactory ? "SENT_TO_FACTORY" : "DRAFT";

    const order = await prisma.order.create({
      data: {
        orderNumber,
        customerName,
        customerEmail,
        customerPhone: customerPhone || null,
        status: initialStatus,
        subtotal: total,
        total,
        notes: notes || null,
        userId,
        ...(submitToFactory
          ? {
              sentToFactoryAt: new Date(),
            }
          : {}),
        items: {
          create: [
            {
              productId,
              productNameSnapshot: productName,
              basePriceSnapshot: basePrice,
              quantity: 1,
              lineTotal: total,
              selections: {
                create: selections.flatMap((selection: IncomingSelection) => {
                  const rows = [
                    {
                      optionGroupNameSnapshot: selection.groupName,
                      optionChoiceNameSnapshot: selection.choiceLabel,
                      priceDeltaSnapshot: selection.baseAmount,
                    },
                  ];

                  if (selection.leatherName) {
                    rows.push({
                      optionGroupNameSnapshot: `${selection.groupName} Leather`,
                      optionChoiceNameSnapshot: `${selection.leatherName}${
                        selection.leatherGrade
                          ? ` (${selection.leatherGrade})`
                          : ""
                      }`,
                      priceDeltaSnapshot: selection.leatherSurcharge || 0,
                    });
                  }

                  return rows;
                }),
              },
            },
          ],
        },
        revisions: {
          create: {
            revisionNumber: 1,
            changedBy: customerEmail,
            changeReason: submitToFactory
              ? "Customer sent order to factory"
              : "Initial draft creation",
            beforeJson: {},
            afterJson: {
              productId,
              productName,
              customerName,
              customerEmail,
              customerPhone,
              notes,
              basePrice,
              total,
              status: initialStatus,
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
      },
    });

    try {
      await sendOrderNotification({
        type: submitToFactory ? "sent_to_factory" : "created",
        orderNumber,
        customerName,
        customerEmail,
        customerPhone,
        notes,
        productName,
        total,
        selections,
      });

      await prisma.emailLog.createMany({
        data: [
          {
            orderId: order.id,
            eventType: submitToFactory
              ? "ORDER_SENT_TO_FACTORY_CUSTOMER"
              : "ORDER_CREATED_CUSTOMER",
            recipient: customerEmail,
            subject: submitToFactory
              ? `Your order was sent to the factory: ${orderNumber}`
              : `We received your order draft: ${orderNumber}`,
            status: "SENT",
          },
          {
            orderId: order.id,
            eventType: submitToFactory
              ? "ORDER_SENT_TO_FACTORY_INTERNAL"
              : "ORDER_CREATED_INTERNAL",
            recipient: process.env.ORDER_NOTIFY_TO || "",
            subject: submitToFactory
              ? `Order Sent to Factory: ${orderNumber}`
              : `New Order Draft: ${orderNumber}`,
            status: "SENT",
          },
        ],
      });
    } catch (error) {
      console.error("ORDER EMAIL ERROR:", error);

      await prisma.emailLog.create({
        data: {
          orderId: order.id,
          eventType: submitToFactory
            ? "ORDER_SENT_TO_FACTORY"
            : "ORDER_CREATED",
          recipient: customerEmail,
          subject: submitToFactory
            ? `Your order was sent to the factory: ${orderNumber}`
            : `We received your order draft: ${orderNumber}`,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown email error",
        },
      });
    }

    try {
      await appendOrderRow({
        eventType: submitToFactory ? "updated" : "created",
        orderNumber,
        status: initialStatus,
        customerName,
        customerEmail,
        customerPhone,
        productName,
        total,
        notes,
        selectionsText: buildSelectionsText(selections),
      });

      await prisma.sheetSyncLog.create({
        data: {
          orderId: order.id,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "APPENDED",
          status: "SYNCED",
        },
      });
    } catch (error) {
      console.error("ORDER SHEETS ERROR:", error);

      await prisma.sheetSyncLog.create({
        data: {
          orderId: order.id,
          spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID || null,
          worksheetName: process.env.GOOGLE_SHEETS_TAB_NAME || "Orders",
          spreadsheetRowId: "APPEND_FAILED",
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown sheets error",
        },
      });
    }

    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    console.error("CREATE ORDER ERROR:", error);
    return NextResponse.json(
      { error: "Failed to create order." },
      { status: 500 }
    );
  }
}