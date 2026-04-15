import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFImage, type PDFPage } from "pdf-lib";

export const runtime = "nodejs";

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

type RemoteImage = {
  image: PDFImage;
  width: number;
  height: number;
};

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const PAGE_MARGIN = 40;
const SECTION_COLORS = [
  rgb(0.15, 0.39, 0.92),
  rgb(0.09, 0.64, 0.29),
  rgb(0.92, 0.35, 0.05),
  rgb(0.48, 0.23, 0.89),
  rgb(0.86, 0.15, 0.15),
  rgb(0.03, 0.57, 0.72),
  rgb(0.79, 0.54, 0.02),
  rgb(0.75, 0.09, 0.38),
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number) {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    const trial = currentLine ? `${currentLine} ${word}` : word;
    const trialWidth = font.widthOfTextAtSize(trial, fontSize);

    if (trialWidth <= maxWidth) {
      currentLine = trial;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

function drawWrappedText(params: {
  page: PDFPage;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  font: PDFFont;
  fontSize: number;
  lineHeight?: number;
  color?: ReturnType<typeof rgb>;
}) {
  const {
    page,
    text,
    x,
    y,
    maxWidth,
    font,
    fontSize,
    lineHeight = fontSize + 4,
    color = rgb(0.07, 0.09, 0.15),
  } = params;

  const lines = wrapText(text, font, fontSize, maxWidth);
  let currentY = y;

  for (const line of lines) {
    page.drawText(line, {
      x,
      y: currentY,
      size: fontSize,
      font,
      color,
    });
    currentY -= lineHeight;
  }

  return currentY;
}

function drawRectLabel(params: {
  page: PDFPage;
  x: number;
  y: number;
  text: string;
  font: PDFFont;
  color: ReturnType<typeof rgb>;
}) {
  const { page, x, y, text, font, color } = params;
  const fontSize = 11;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const width = textWidth + 20;
  const height = 22;

function drawRectLabel(params: {
  page: PDFPage;
  x: number;
  y: number;
  text: string;
  font: PDFFont;
  color: ReturnType<typeof rgb>;
}) {
  const { page, x, y, text, font, color } = params;
  const fontSize = 11;
  const textWidth = font.widthOfTextAtSize(text, fontSize);
  const width = textWidth + 20;
  const height = 22;

  page.drawRectangle({
    x,
    y: y - 4,
    width,
    height,
    color,
  });

  page.drawText(text, {
    x: x + 10,
    y: y + 3,
    size: fontSize,
    font,
    color: rgb(1, 1, 1),
  });

  return { width, height };
}
  page.drawText(text, {
    x: x + 10,
    y: y + 3,
    size: fontSize,
    font,
    color: rgb(1, 1, 1),
  });

  return { width, height };
}

async function embedRemoteImage(
  pdfDoc: PDFDocument,
  url?: string | null
): Promise<RemoteImage | null> {
  if (!url) return null;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    const bytes = await response.arrayBuffer();
    const uint8 = new Uint8Array(bytes);

    if (contentType.includes("png")) {
      const image = await pdfDoc.embedPng(uint8);
      return { image, width: image.width, height: image.height };
    }

    if (contentType.includes("jpeg") || contentType.includes("jpg")) {
      const image = await pdfDoc.embedJpg(uint8);
      return { image, width: image.width, height: image.height };
    }

    if (uint8[0] === 0x89 && uint8[1] === 0x50 && uint8[2] === 0x4e && uint8[3] === 0x47) {
      const image = await pdfDoc.embedPng(uint8);
      return { image, width: image.width, height: image.height };
    }

    if (uint8[0] === 0xff && uint8[1] === 0xd8) {
      const image = await pdfDoc.embedJpg(uint8);
      return { image, width: image.width, height: image.height };
    }

    return null;
  } catch {
    return null;
  }
}

function drawImageOrPlaceholder(params: {
  page: PDFPage;
  x: number;
  y: number;
  width: number;
  height: number;
  borderColor: ReturnType<typeof rgb>;
  font: PDFFont;
  title: string;
  image: RemoteImage | null;
}) {
  const { page, x, y, width, height, borderColor, font, title, image } = params;

  page.drawText(title, {
    x,
    y: y + height + 8,
    size: 10,
    font,
    color: rgb(0.3, 0.35, 0.42),
  });

  page.drawRectangle({
    x,
    y,
    width,
    height,
    borderColor,
    borderWidth: 2,
  });

  if (!image) {
    page.drawText("No Image", {
      x: x + 16,
      y: y + height / 2 - 6,
      size: 12,
      font,
      color: rgb(0.6, 0.65, 0.72),
    });
    return;
  }

  const scale = Math.min(width / image.width, height / image.height);
  const drawWidth = image.width * scale;
  const drawHeight = image.height * scale;
  const drawX = x + (width - drawWidth) / 2;
  const drawY = y + (height - drawHeight) / 2;

  page.drawImage(image.image, {
    x: drawX,
    y: drawY,
    width: drawWidth,
    height: drawHeight,
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const productName = String(body.productName || "").trim();
    const customerName = String(body.customerName || "").trim();
    const customerEmail = String(body.customerEmail || "").trim();
    const customerPhone = String(body.customerPhone || "").trim();
    const notes = String(body.notes || "").trim();
    const total = Number(body.total || 0);

    const selections = Array.isArray(body.selections)
      ? (body.selections as IncomingSelection[])
      : [];

    const lineItems = Array.isArray(body.lineItems)
      ? (body.lineItems as IncomingLineItem[])
      : [];

    const pdfDoc = await PDFDocument.create();
    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let cursorY = PAGE_HEIGHT - PAGE_MARGIN;

    const startNewPage = () => {
      page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      cursorY = PAGE_HEIGHT - PAGE_MARGIN;
    };

    const ensureSpace = (requiredHeight: number) => {
      if (cursorY - requiredHeight < PAGE_MARGIN) {
        startNewPage();
      }
    };

    page.drawText("Factory Order Summary", {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 24,
      font: boldFont,
      color: rgb(0.07, 0.09, 0.15),
    });
    cursorY -= 30;

    cursorY = drawWrappedText({
      page,
      text: `Product: ${productName}`,
      x: PAGE_MARGIN,
      y: cursorY,
      maxWidth: 250,
      font: boldFont,
      fontSize: 14,
    }) - 6;

    cursorY = drawWrappedText({
      page,
      text: `Customer: ${customerName}`,
      x: PAGE_MARGIN,
      y: cursorY,
      maxWidth: 250,
      font,
      fontSize: 12,
    });

    cursorY = drawWrappedText({
      page,
      text: `Email: ${customerEmail}`,
      x: PAGE_MARGIN,
      y: cursorY,
      maxWidth: 320,
      font,
      fontSize: 12,
    });

    if (customerPhone) {
      cursorY = drawWrappedText({
        page,
        text: `Phone: ${customerPhone}`,
        x: PAGE_MARGIN,
        y: cursorY,
        maxWidth: 250,
        font,
        fontSize: 12,
      });
    }

    if (notes) {
      cursorY -= 6;
      cursorY = drawWrappedText({
        page,
        text: `Notes: ${notes}`,
        x: PAGE_MARGIN,
        y: cursorY,
        maxWidth: PAGE_WIDTH - PAGE_MARGIN * 2,
        font,
        fontSize: 11,
      });
    }

    cursorY -= 6;
    page.drawText(`Total: ${formatCurrency(total)}`, {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 14,
      font: boldFont,
      color: rgb(0.07, 0.09, 0.15),
    });
    cursorY -= 28;

    if (lineItems.length > 0) {
      ensureSpace(120);

      page.drawText("Itemized Price", {
        x: PAGE_MARGIN,
        y: cursorY,
        size: 16,
        font: boldFont,
        color: rgb(0.07, 0.09, 0.15),
      });
      cursorY -= 22;

      for (const line of lineItems) {
        page.drawText(line.label, {
          x: PAGE_MARGIN,
          y: cursorY,
          size: 10,
          font,
          color: rgb(0.15, 0.17, 0.22),
        });

        const amountText =
          line.amount === 0 ? "Included" : `+${formatCurrency(line.amount)}`;
        const textWidth = font.widthOfTextAtSize(amountText, 10);

        page.drawText(amountText, {
          x: PAGE_WIDTH - PAGE_MARGIN - textWidth,
          y: cursorY,
          size: 10,
          font,
          color: rgb(0.15, 0.17, 0.22),
        });

        cursorY -= 14;
      }

      cursorY -= 12;
    }

    ensureSpace(40);
    page.drawText("Factory Sections", {
      x: PAGE_MARGIN,
      y: cursorY,
      size: 18,
      font: boldFont,
      color: rgb(0.07, 0.09, 0.15),
    });
    cursorY -= 26;

    for (let index = 0; index < selections.length; index += 1) {
      const selection = selections[index];
      const color = SECTION_COLORS[index % SECTION_COLORS.length];
      const cardHeight = 258;
      const cardWidth = PAGE_WIDTH - PAGE_MARGIN * 2;

      ensureSpace(cardHeight + 18);

      page.drawRectangle({
        x: PAGE_MARGIN,
        y: cursorY - cardHeight,
        width: cardWidth,
        height: cardHeight,
        borderColor: color,
        borderWidth: 2,
      });

      drawRectLabel({
        page,
        x: PAGE_MARGIN + 16,
        y: cursorY - 24,
        text: selection.groupName.toUpperCase(),
        font: boldFont,
        color,
      });

      let textY = cursorY - 52;

const hasLeather = Boolean(selection.leatherName);

if (hasLeather) {
  page.drawText(`Leather: ${selection.leatherName}`, {
    x: PAGE_MARGIN + 16,
    y: textY,
    size: 14,
    font: boldFont,
    color: rgb(0.07, 0.09, 0.15),
  });
  textY -= 18;

  if (selection.leatherGrade) {
    page.drawText(`Grade: ${selection.leatherGrade}`, {
      x: PAGE_MARGIN + 16,
      y: textY,
      size: 11,
      font,
      color: rgb(0.3, 0.35, 0.42),
    });
    textY -= 16;
  }
}

const optionImage = await embedRemoteImage(pdfDoc, selection.imageUrl);
const leatherImage = hasLeather
  ? await embedRemoteImage(pdfDoc, selection.leatherImageUrl)
  : null;

const imageTopY = cursorY - 212;
const imageWidth = 180;
const imageHeight = 130;
const leftX = PAGE_MARGIN + 16;

drawImageOrPlaceholder({
  page,
  x: leftX,
  y: imageTopY,
  width: imageWidth,
  height: imageHeight,
  borderColor: color,
  font,
  title: "OPTION IMAGE",
  image: optionImage,
});

if (hasLeather) {
  const rightX = PAGE_MARGIN + 16 + imageWidth + 22;

  drawImageOrPlaceholder({
    page,
    x: rightX,
    y: imageTopY,
    width: imageWidth,
    height: imageHeight,
    borderColor: color,
    font,
    title: "LEATHER IMAGE",
    image: leatherImage,
  });
}

      cursorY -= cardHeight + 18;
    }
const bytes = await pdfDoc.save();
const pdfBuffer = bytes.buffer.slice(
  bytes.byteOffset,
  bytes.byteOffset + bytes.byteLength
) as ArrayBuffer;

return new Response(pdfBuffer, {
  headers: {
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename="factory-order-${Date.now()}.pdf"`,
  },
});
  } catch (error) {
    console.error("PDF GENERATION ERROR:", error);

    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to generate PDF.",
      },
      { status: 500 }
    );
  }
}