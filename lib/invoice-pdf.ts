import PDFDocument from "pdfkit";
import { PassThrough } from "stream";

type InvoiceItemSummary = {
  productName: string;
  quantity: number;
  basePrice: number;
  lineTotal: number;
  selections: {
    groupName: string;
    choiceLabel: string;
    leatherName: string | null;
    leatherGrade: string | null;
    amount: number;
  }[];
};

type InvoiceForPdf = {
  invoiceNumber: string;
  customerName: string;
  customerEmail: string;
  status: string;
  subtotal: unknown;
  surchargeLabel: string | null;
  surchargeAmount: unknown;
  total: unknown;
  terms: string;
  issuedAt: Date;
  dueAt: Date;
  notes: string | null;
  orders: {
    orderNumber: string;
    poNumber: string | null;
    productSummary: string;
    itemSummary: unknown;
    quantity: number;
    orderTotal: unknown;
  }[];
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Chicago",
    dateStyle: "medium",
  }).format(date);
}

function parseItemSummary(value: unknown): InvoiceItemSummary[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (!item || typeof item !== "object") return null;

      const rawItem = item as Partial<InvoiceItemSummary>;

      return {
        productName: String(rawItem.productName || "Item"),
        quantity: Number(rawItem.quantity || 1),
        basePrice: Number(rawItem.basePrice || 0),
        lineTotal: Number(rawItem.lineTotal || 0),
        selections: Array.isArray(rawItem.selections)
          ? rawItem.selections.map((selection) => ({
              groupName: String(selection.groupName || ""),
              choiceLabel: String(selection.choiceLabel || ""),
              leatherName: selection.leatherName
                ? String(selection.leatherName)
                : null,
              leatherGrade: selection.leatherGrade
                ? String(selection.leatherGrade)
                : null,
              amount: Number(selection.amount || 0),
            }))
          : [],
      };
    })
    .filter(Boolean) as InvoiceItemSummary[];
}

function collectPdf(doc: PDFKit.PDFDocument) {
  const stream = new PassThrough();
  const chunks: Buffer[] = [];

  doc.pipe(stream);

  return new Promise<Buffer>((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

function addFooter(doc: PDFKit.PDFDocument) {
  const bottom = doc.page.height - 50;

  doc
    .fontSize(9)
    .fillColor("#64748b")
    .text("Thank you for your business.", 50, bottom, {
      align: "center",
      width: doc.page.width - 100,
    });

  doc.fillColor("#111827");
}

function ensureSpace(doc: PDFKit.PDFDocument, neededHeight = 80) {
  if (doc.y + neededHeight > doc.page.height - 80) {
    doc.addPage();
  }
}

export async function buildInvoicePdfBuffer(invoice: InvoiceForPdf) {
  const doc = new PDFDocument({
    size: "LETTER",
    margin: 50,
    bufferPages: true,
  });

  const done = collectPdf(doc);

  doc.fontSize(26).fillColor("#111827").text("INVOICE", 50, 50);
  doc
    .fontSize(12)
    .fillColor("#475569")
    .text(invoice.invoiceNumber, 50, 82);

  doc
    .fontSize(10)
    .fillColor("#475569")
    .text(`Issued: ${formatDate(invoice.issuedAt)}`, 360, 50, {
      align: "right",
      width: 180,
    })
    .text(`Due Date: ${formatDate(invoice.dueAt)}`, 360, 66, {
      align: "right",
      width: 180,
    })
    .text(`Terms: ${invoice.terms}`, 360, 82, {
      align: "right",
      width: 180,
    });

  doc.moveDown(3);

  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text("BILL TO", 50, 130);

  doc
    .fontSize(14)
    .fillColor("#111827")
    .text(invoice.customerName, 50, 148)
    .fontSize(10)
    .fillColor("#475569")
    .text(invoice.customerEmail, 50, 168);

  doc
    .fontSize(10)
    .fillColor("#64748b")
    .text("TOTAL DUE", 360, 130, {
      align: "right",
      width: 180,
    });

  doc
    .fontSize(22)
    .fillColor("#111827")
    .text(formatCurrency(Number(invoice.total || 0)), 360, 148, {
      align: "right",
      width: 180,
    });

  doc
    .fontSize(10)
    .fillColor("#475569")
    .text("Due upon receipt", 360, 176, {
      align: "right",
      width: 180,
    });

  doc.moveTo(50, 210).lineTo(560, 210).strokeColor("#e2e8f0").stroke();

  doc.y = 235;

  for (const invoiceOrder of invoice.orders) {
    ensureSpace(doc, 130);

    doc
      .fontSize(14)
      .fillColor("#111827")
      .text(invoiceOrder.orderNumber);

    doc
      .fontSize(10)
      .fillColor("#475569")
      .text(`PO #: ${invoiceOrder.poNumber || "—"}`)
      .text(`Items: ${invoiceOrder.productSummary}`)
      .text(`Quantity: ${invoiceOrder.quantity}`);

    doc
      .fontSize(12)
      .fillColor("#111827")
      .text(formatCurrency(Number(invoiceOrder.orderTotal || 0)), 430, doc.y - 42, {
        align: "right",
        width: 110,
      });

    doc.moveDown(0.8);

    const items = parseItemSummary(invoiceOrder.itemSummary);

    for (const item of items) {
      ensureSpace(doc, 80);

      doc
        .fontSize(11)
        .fillColor("#111827")
        .text(`${item.productName} — Qty ${item.quantity}`);

      if (item.selections.length > 0) {
        doc.fontSize(8).fillColor("#475569");

        for (const selection of item.selections.slice(0, 8)) {
          const leather = selection.leatherName
            ? ` • Leather: ${selection.leatherName}${
                selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
              }`
            : "";

          doc.text(
            `• ${selection.groupName}: ${selection.choiceLabel}${leather}`,
            {
              indent: 12,
              width: 470,
            }
          );
        }

        if (item.selections.length > 8) {
          doc.text(`• +${item.selections.length - 8} more selections`, {
            indent: 12,
          });
        }
      }

      doc.moveDown(0.5);
    }

    doc.moveTo(50, doc.y + 6).lineTo(560, doc.y + 6).strokeColor("#e2e8f0").stroke();
    doc.moveDown(1.4);
  }

  ensureSpace(doc, 150);

  const summaryX = 340;
  const valueX = 460;

  doc.fontSize(11).fillColor("#475569");
  doc.text("Subtotal", summaryX, doc.y, { width: 110 });
  doc.fillColor("#111827").text(formatCurrency(Number(invoice.subtotal || 0)), valueX, doc.y - 13, {
    align: "right",
    width: 90,
  });

  if (Number(invoice.surchargeAmount || 0) > 0) {
    doc.moveDown(0.6);
    doc.fillColor("#475569").text(invoice.surchargeLabel || "Surcharge", summaryX, doc.y, {
      width: 110,
    });
    doc.fillColor("#111827").text(
      formatCurrency(Number(invoice.surchargeAmount || 0)),
      valueX,
      doc.y - 13,
      {
        align: "right",
        width: 90,
      }
    );
  }

  doc.moveDown(0.8);
  doc.moveTo(summaryX, doc.y).lineTo(550, doc.y).strokeColor("#e2e8f0").stroke();
  doc.moveDown(0.8);

  doc.fontSize(15).fillColor("#111827").text("Total Due", summaryX, doc.y, {
    width: 110,
  });
  doc.text(formatCurrency(Number(invoice.total || 0)), valueX, doc.y - 17, {
    align: "right",
    width: 90,
  });

  if (invoice.notes) {
    ensureSpace(doc, 80);
    doc.moveDown(2);
    doc.fontSize(10).fillColor("#64748b").text("NOTES");
    doc.fontSize(10).fillColor("#111827").text(invoice.notes, {
      width: 500,
    });
  }

  addFooter(doc);
  doc.end();

  return done;
}