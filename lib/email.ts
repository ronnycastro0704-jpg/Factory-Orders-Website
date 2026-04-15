import nodemailer from "nodemailer";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

type OrderSelection = {
  groupName: string;
  choiceLabel: string;
  leatherName?: string | null;
  leatherGrade?: string | null;
  baseAmount: number;
  leatherSurcharge: number;
  imageUrl?: string | null;
  leatherImageUrl?: string | null;
};

type SendOrderEmailInput = {
  type: "created" | "updated" | "sent_to_factory" | "completed";
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  notes?: string | null;
  productName: string;
  total: number;
  selections: OrderSelection[];
};

const SECTION_COLORS = [
  "#2563eb",
  "#16a34a",
  "#ea580c",
  "#7c3aed",
  "#dc2626",
  "#0891b2",
  "#ca8a04",
  "#be185d",
];

function getSectionColor(index: number) {
  return SECTION_COLORS[index % SECTION_COLORS.length];
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildSelectionsText(selections: OrderSelection[]) {
  return selections
    .map((selection, index) => {
      const colorNumber = index + 1;

      const lines = [
        `SECTION ${colorNumber}: ${selection.groupName.toUpperCase()}`,
        `Style: ${selection.choiceLabel}`,
      ];

      if (selection.leatherName) {
        lines.push(
          `Leather: ${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`
        );
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function buildSelectionsHtml(selections: OrderSelection[]) {
  return selections
    .map((selection, index) => {
      const color = getSectionColor(index);
      const safeGroupName = escapeHtml(selection.groupName);
      const safeChoiceLabel = escapeHtml(selection.choiceLabel);
      const safeLeatherName = selection.leatherName
        ? escapeHtml(selection.leatherName)
        : "";
      const safeLeatherGrade = selection.leatherGrade
        ? escapeHtml(selection.leatherGrade)
        : "";
      const safeImageUrl = selection.imageUrl
        ? escapeHtml(selection.imageUrl)
        : "";
      const safeLeatherImageUrl = selection.leatherImageUrl
        ? escapeHtml(selection.leatherImageUrl)
        : "";

      const hasLeather = Boolean(selection.leatherName);

      return `
        <div style="border:2px solid ${color};border-radius:14px;padding:16px;margin-bottom:18px;background:#ffffff;">
          <div style="display:inline-block;background:${color};color:#ffffff;font-weight:700;font-size:13px;padding:6px 10px;border-radius:999px;margin-bottom:12px;">
            ${safeGroupName.toUpperCase()}
          </div>

          <div style="margin-bottom:10px;">
            <p style="margin:0 0 6px 0;font-size:18px;font-weight:700;color:#111827;">
              Style: ${safeChoiceLabel}
            </p>
            ${
              hasLeather
                ? `<p style="margin:0 0 4px 0;font-size:16px;font-weight:700;color:#111827;">
                    Leather: ${safeLeatherName}
                  </p>`
                : ""
            }
            ${
              hasLeather && selection.leatherGrade
                ? `<p style="margin:0;font-size:14px;color:#475569;">Grade: ${safeLeatherGrade}</p>`
                : ""
            }
          </div>

          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="min-width:180px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#475569;">OPTION IMAGE</p>
              ${
                safeImageUrl
                  ? `<img src="${safeImageUrl}" alt="${safeChoiceLabel}" style="width:180px;height:180px;object-fit:cover;border-radius:12px;border:2px solid ${color};" />`
                  : `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">No Option Image</div>`
              }
            </div>

            ${
              hasLeather
                ? `<div style="min-width:180px;">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#475569;">LEATHER IMAGE</p>
                    ${
                      safeLeatherImageUrl
                        ? `<img src="${safeLeatherImageUrl}" alt="${safeLeatherName}" style="width:180px;height:180px;object-fit:cover;border-radius:12px;border:2px solid ${color};" />`
                        : `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">No Leather Image</div>`
                    }
                  </div>`
                : ""
            }
          </div>
        </div>
      `;
    })
    .join("");
}

function getTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error("Missing SMTP env vars.");
  }

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: {
      user,
      pass,
    },
  });
}

function getEmailCopy(type: SendOrderEmailInput["type"], orderNumber: string) {
  switch (type) {
    case "created":
      return {
        internalSubject: `New Order Draft: ${orderNumber}`,
        customerSubject: `We received your order draft: ${orderNumber}`,
        customerIntro: "We received your furniture order draft.",
      };
    case "updated":
      return {
        internalSubject: `Order Updated: ${orderNumber}`,
        customerSubject: `Your order was updated: ${orderNumber}`,
        customerIntro: "Your furniture order has been updated.",
      };
    case "sent_to_factory":
      return {
        internalSubject: `Order Sent to Factory: ${orderNumber}`,
        customerSubject: `Your order was sent to the factory: ${orderNumber}`,
        customerIntro: "Your furniture order has been sent to the factory.",
      };
    case "completed":
      return {
        internalSubject: `Order Completed: ${orderNumber}`,
        customerSubject: `Your order is completed: ${orderNumber}`,
        customerIntro: "Your furniture order has been marked as completed.",
      };
  }
}

export async function sendOrderNotification(input: SendOrderEmailInput) {
  const {
    type,
    orderNumber,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    productName,
    total,
    selections,
  } = input;

  const from = process.env.MAIL_FROM;
  const notifyTo = process.env.ORDER_NOTIFY_TO;

  if (!from || !notifyTo) {
    throw new Error("Missing MAIL_FROM or ORDER_NOTIFY_TO.");
  }

  const transporter = getTransporter();
  const copy = getEmailCopy(type, orderNumber);

  const internalText = [
    copy.internalSubject,
    "",
    `Order Number: ${orderNumber}`,
    `Customer: ${customerName}`,
    `Email: ${customerEmail}`,
    customerPhone ? `Phone: ${customerPhone}` : "",
    `Product: ${productName}`,
    `Total: ${formatCurrency(total)}`,
    notes ? `Notes: ${notes}` : "",
    "",
    "FACTORY SECTIONS:",
    buildSelectionsText(selections),
  ]
    .filter(Boolean)
    .join("\n");

  const internalHtml = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;background:#f8fafc;color:#111827;">
      <h1 style="margin:0 0 16px 0;font-size:24px;">${escapeHtml(
        copy.internalSubject
      )}</h1>

      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p><strong>Order Number:</strong> ${escapeHtml(orderNumber)}</p>
        <p><strong>Customer:</strong> ${escapeHtml(customerName)}</p>
        <p><strong>Email:</strong> ${escapeHtml(customerEmail)}</p>
        ${
          customerPhone
            ? `<p><strong>Phone:</strong> ${escapeHtml(customerPhone)}</p>`
            : ""
        }
        <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
        <p><strong>Total:</strong> ${formatCurrency(total)}</p>
        ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
      </div>

      <h2 style="font-size:22px;margin:0 0 16px 0;">Factory Sections</h2>
      ${buildSelectionsHtml(selections)}
    </div>
  `;

  await transporter.sendMail({
    from,
    to: notifyTo,
    replyTo: customerEmail,
    subject: copy.internalSubject,
    text: internalText,
    html: internalHtml,
  });

  const customerText = [
    `Hello ${customerName},`,
    "",
    copy.customerIntro,
    "",
    `Order Number: ${orderNumber}`,
    `Product: ${productName}`,
    `Total: ${formatCurrency(total)}`,
    "",
    "Selections:",
    buildSelectionsText(selections),
    "",
    notes ? `Notes: ${notes}` : "",
    "",
    "If you need help, reply to this email.",
  ]
    .filter(Boolean)
    .join("\n");

  const customerHtml = `
    <div style="font-family:Arial,sans-serif;max-width:900px;margin:0 auto;padding:24px;background:#f8fafc;color:#111827;">
      <h1 style="margin:0 0 16px 0;font-size:24px;">${escapeHtml(
        copy.customerSubject
      )}</h1>

      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>${escapeHtml(copy.customerIntro)}</p>
        <p><strong>Order Number:</strong> ${escapeHtml(orderNumber)}</p>
        <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
        <p><strong>Total:</strong> ${formatCurrency(total)}</p>
        ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
      </div>

      <h2 style="font-size:22px;margin:0 0 16px 0;">Selections</h2>
      ${buildSelectionsHtml(selections)}

      <p style="margin-top:24px;font-size:14px;color:#475569;">
        If you need help, reply to this email.
      </p>
    </div>
  `;

  await transporter.sendMail({
    from,
    to: customerEmail,
    replyTo: notifyTo,
    subject: copy.customerSubject,
    text: customerText,
    html: customerHtml,
  });
}