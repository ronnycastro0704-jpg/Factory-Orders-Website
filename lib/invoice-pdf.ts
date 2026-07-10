import { jsPDF } from "jspdf";

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
  surchargeLabel?: string | null;
  surchargeAmount?: unknown;
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

function addWrappedText(args: {
  doc: jsPDF;
  text: string;
  x: number;
  y: number;
  maxWidth: number;
  lineHeight?: number;
}) {
  const { doc, text, x, y, maxWidth, lineHeight = 5 } = args;
  const lines = doc.splitTextToSize(text, maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function ensureSpace(doc: jsPDF, y: number, needed = 25) {
  if (y + needed <= 270) {
    return y;
  }

  doc.addPage();
  return 20;
}

function addFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();

  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Thank you for your business.", 105, 285, {
      align: "center",
    });
    doc.text(`Page ${page} of ${pageCount}`, 195, 285, {
      align: "right",
    });
  }

  doc.setTextColor(17, 24, 39);
}

export async function buildInvoicePdfBuffer(invoice: InvoiceForPdf) {
  const doc = new jsPDF({
    unit: "mm",
    format: "letter",
    orientation: "portrait",
  });

  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFont("helvetica", "bold");
  doc.setFontSize(28);
  doc.setTextColor(17, 24, 39);
  doc.text("INVOICE", 15, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text(invoice.invoiceNumber, 15, 28);

  doc.setFontSize(10);
  doc.text(`Issued: ${formatDate(invoice.issuedAt)}`, pageWidth - 15, 18, {
    align: "right",
  });
  doc.text(`Due Date: ${formatDate(invoice.dueAt)}`, pageWidth - 15, 24, {
    align: "right",
  });
  doc.text(`Terms: ${invoice.terms}`, pageWidth - 15, 30, {
    align: "right",
  });

  doc.setDrawColor(226, 232, 240);
  doc.line(15, 40, pageWidth - 15, 40);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("BILL TO", 15, 50);

  doc.setFontSize(13);
  doc.setTextColor(17, 24, 39);
  doc.text(invoice.customerName, 15, 58);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text(invoice.customerEmail, 15, 64);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  doc.text("TOTAL DUE", pageWidth - 15, 50, {
    align: "right",
  });

  doc.setFontSize(22);
  doc.setTextColor(17, 24, 39);
  doc.text(formatCurrency(Number(invoice.total || 0)), pageWidth - 15, 60, {
    align: "right",
  });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105);
  doc.text("Due upon receipt", pageWidth - 15, 67, {
    align: "right",
  });

  let y = 82;

  for (const invoiceOrder of invoice.orders) {
    y = ensureSpace(doc, y, 45);

    doc.setDrawColor(226, 232, 240);
    doc.line(15, y, pageWidth - 15, y);
    y += 8;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(13);
    doc.setTextColor(17, 24, 39);
    doc.text(invoiceOrder.orderNumber, 15, y);

    doc.text(formatCurrency(Number(invoiceOrder.orderTotal || 0)), pageWidth - 15, y, {
      align: "right",
    });

    y += 7;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    doc.text(`PO #: ${invoiceOrder.poNumber || "—"}`, 15, y);
    y += 6;

    y = addWrappedText({
      doc,
      text: `Items: ${invoiceOrder.productSummary}`,
      x: 15,
      y,
      maxWidth: 130,
      lineHeight: 5,
    });

    doc.text(`Quantity: ${invoiceOrder.quantity}`, 15, y);
    y += 8;

    const items = parseItemSummary(invoiceOrder.itemSummary);

    for (const item of items) {
      y = ensureSpace(doc, y, 35);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(17, 24, 39);
      y = addWrappedText({
        doc,
        text: `${item.productName} — Qty ${item.quantity}`,
        x: 20,
        y,
        maxWidth: 120,
        lineHeight: 5,
      });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(71, 85, 105);
      doc.text(`Base: ${formatCurrency(item.basePrice)}`, 20, y);
      doc.text(formatCurrency(item.lineTotal), pageWidth - 20, y, {
        align: "right",
      });
      y += 6;

      for (const selection of item.selections.slice(0, 8)) {
        y = ensureSpace(doc, y, 12);

        const leather = selection.leatherName
          ? ` • Leather: ${selection.leatherName}${
              selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
            }`
          : "";

        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);

        y = addWrappedText({
          doc,
          text: `• ${selection.groupName}: ${selection.choiceLabel}${leather}`,
          x: 24,
          y,
          maxWidth: 150,
          lineHeight: 4,
        });
      }

      if (item.selections.length > 8) {
        y = ensureSpace(doc, y, 8);
        doc.text(`• +${item.selections.length - 8} more selections`, 24, y);
        y += 5;
      }

      y += 4;
    }
  }

  y = ensureSpace(doc, y, 55);

  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, pageWidth - 15, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(11);
  doc.setTextColor(71, 85, 105);
  doc.text("Subtotal", 120, y);
  doc.setTextColor(17, 24, 39);
  doc.text(formatCurrency(Number(invoice.subtotal || 0)), pageWidth - 15, y, {
    align: "right",
  });
  y += 7;

  if (Number(invoice.surchargeAmount || 0) > 0) {
    doc.setTextColor(71, 85, 105);
    doc.text(invoice.surchargeLabel || "Surcharge", 120, y);
    doc.setTextColor(17, 24, 39);
    doc.text(
      formatCurrency(Number(invoice.surchargeAmount || 0)),
      pageWidth - 15,
      y,
      {
        align: "right",
      }
    );
    y += 7;
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(120, y, pageWidth - 15, y);
  y += 9;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(17, 24, 39);
  doc.text("Total Due", 120, y);
  doc.text(formatCurrency(Number(invoice.total || 0)), pageWidth - 15, y, {
    align: "right",
  });
  y += 12;

  if (invoice.notes) {
    y = ensureSpace(doc, y, 35);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("NOTES", 15, y);
    y += 6;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(17, 24, 39);

    addWrappedText({
      doc,
      text: invoice.notes,
      x: 15,
      y,
      maxWidth: pageWidth - 30,
      lineHeight: 5,
    });
  }

  addFooter(doc);

  const arrayBuffer = doc.output("arraybuffer");
  return Buffer.from(arrayBuffer);
}