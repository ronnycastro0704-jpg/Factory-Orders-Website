import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

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
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const productName = String(body.productName || "");
    const customerName = String(body.customerName || "");
    const customerEmail = String(body.customerEmail || "");
    const customerPhone = String(body.customerPhone || "");
    const notes = String(body.notes || "");
    const total = Number(body.total || 0);

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    const pdfDoc = await PDFDocument.create();
    let page = pdfDoc.addPage([612, 792]);
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

    const { width, height } = page.getSize();
    const margin = 50;
    let y = height - margin;

    const titleSize = 20;
    const headingSize = 14;
    const bodySize = 11;
    const lineGap = 16;

    function drawText(text: string, size = bodySize) {
      if (y < 60) {
        page = pdfDoc.addPage([612, 792]);
        y = height - margin;
      }

      page.drawText(text, {
        x: margin,
        y,
        size,
        font,
        color: rgb(0, 0, 0),
      });

      y -= lineGap;
    }

    drawText("Furniture Order Draft", titleSize);
    y -= 10;

    drawText(`Product: ${productName}`);
    drawText(`Customer: ${customerName}`);
    drawText(`Email: ${customerEmail}`);
    if (customerPhone) drawText(`Phone: ${customerPhone}`);
    if (notes) drawText(`Notes: ${notes}`);
    y -= 10;

    drawText("Selections", headingSize);
    y -= 4;

    for (const selection of selections) {
      drawText(
        `${selection.groupName}: ${selection.choiceLabel} (${formatCurrency(
          selection.baseAmount
        )})`
      );

      if (selection.leatherName) {
        drawText(
          `  Leather: ${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          } (${formatCurrency(selection.leatherSurcharge)})`
        );
      }
    }

    y -= 10;
    drawText("Itemized Pricing", headingSize);
    y -= 4;

    for (const line of lineItems) {
      drawText(`${line.label}: ${formatCurrency(line.amount)}`);
    }

    y -= 10;
    drawText(`Total: ${formatCurrency(total)}`, headingSize);

    const pdfBytes = await pdfDoc.save();

    return new Response(new Uint8Array(pdfBytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="order-draft.pdf"',
      },
    });
  } catch (error) {
    console.error("PDF GENERATION ERROR:", error);
    return new Response("Failed to generate PDF", { status: 500 });
  }
}