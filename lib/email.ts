import nodemailer from "nodemailer";

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

type OrderLineItem = {
  label: string;
  amount: number;
};

type OrderSelection = {
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
  isBodyLeather?: boolean;
};

type SendOrderEmailInput = {
  type: "created" | "updated" | "sent_to_factory" | "completed";
  orderNumber: string;
  poNumber?: string | null;
  quantity?: number | null;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  notes?: string | null;
  productName: string;
  total: number;
  lineItems?: OrderLineItem[];
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

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function buildBodyLeatherSummary(selections: OrderSelection[]) {
  const explicit = Array.from(
    new Set(
      selections
        .filter((selection) => selection.isBodyLeather && selection.leatherName)
        .map((selection) =>
          `${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`.trim()
        )
        .filter(Boolean)
    )
  );

  if (explicit.length > 0) {
    return explicit.join(", ");
  }

  const allLeathers = Array.from(
    new Set(
      selections
        .filter((selection) => selection.leatherName)
        .map((selection) =>
          `${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`.trim()
        )
        .filter(Boolean)
    )
  );

  if (allLeathers.length === 1) {
    return allLeathers[0];
  }

  return "";
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

      if (selection.isBodyLeather) {
        lines.push("Body Leather: Yes");
      }

      if (selection.laseredBrand) {
        lines.push("Lasered Brand: Yes");
        if (selection.laseredBrandImageUrl) {
          lines.push(`Lasered Brand Image: ${selection.laseredBrandImageUrl}`);
        }
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function buildFactorySelectionsText(selections: OrderSelection[]) {
  return selections
    .map((selection, index) => {
      const lines = [`${index + 1}. ${selection.groupName}: ${selection.choiceLabel}`];

      if (selection.leatherName) {
        lines.push(
          `   Leather: ${selection.leatherName}${
            selection.leatherGrade ? ` (${selection.leatherGrade})` : ""
          }`
        );
      }

      if (selection.isBodyLeather) {
        lines.push("   Body Leather: Yes");
      }

      if (selection.laseredBrand) {
        lines.push("   Lasered Brand: Yes");
      }

      if (selection.imageUrl) {
        lines.push(`   Option Image: ${selection.imageUrl}`);
      }

      if (selection.leatherImageUrl) {
        lines.push(`   Leather Image: ${selection.leatherImageUrl}`);
      }

      if (selection.laseredBrandImageUrl) {
        lines.push(`   Brand Image: ${selection.laseredBrandImageUrl}`);
      }

      return lines.join("\n");
    })
    .join("\n\n");
}

function buildLineItemsText(lineItems: OrderLineItem[]) {
  if (!lineItems.length) return "";

  return lineItems
    .map((line) => {
      const amountText =
        line.amount === 0 ? "Included" : `+${formatCurrency(line.amount)}`;
      return `${line.label}: ${amountText}`;
    })
    .join("\n");
}

function buildLineItemsHtml(lineItems: OrderLineItem[]) {
  if (!lineItems.length) return "";

  const rows = lineItems
    .map((line) => {
      const amountText =
        line.amount === 0 ? "Included" : `+${formatCurrency(line.amount)}`;

      return `
        <tr>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
            ${escapeHtml(line.label)}
          </td>
          <td style="padding:8px 0;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;text-align:right;font-weight:700;">
            ${escapeHtml(amountText)}
          </td>
        </tr>
      `;
    })
    .join("");

  return `
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:16px 18px;margin-bottom:18px;">
      <h2 style="margin:0 0 12px 0;font-size:18px;line-height:1.2;color:#111827;">Itemized Price</h2>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${rows}
      </table>
    </div>
  `;
}

function buildCustomerSelectionsHtml(selections: OrderSelection[]) {
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
      const safeImageUrl = selection.imageUrl ? escapeHtml(selection.imageUrl) : "";
      const safeLeatherImageUrl = selection.leatherImageUrl
        ? escapeHtml(selection.leatherImageUrl)
        : "";
      const safeLaseredBrandImageUrl = selection.laseredBrandImageUrl
        ? escapeHtml(selection.laseredBrandImageUrl)
        : "";

      const hasLeather = Boolean(selection.leatherName);
      const hasLaseredBrand = Boolean(selection.laseredBrand);

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
                ? `<p style="margin:0 0 4px 0;font-size:14px;color:#475569;">Grade: ${safeLeatherGrade}</p>`
                : ""
            }
            ${
              selection.isBodyLeather
                ? `<p style="margin:0 0 4px 0;font-size:14px;font-weight:700;color:#111827;">Body Leather: Yes</p>`
                : ""
            }
            ${
              hasLaseredBrand
                ? `<p style="margin:0;font-size:14px;font-weight:700;color:#111827;">Lasered Brand: Yes</p>`
                : ""
            }
          </div>

          <div style="display:flex;gap:16px;flex-wrap:wrap;">
            <div style="min-width:180px;">
              <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#475569;">OPTION IMAGE</p>
              ${
                safeImageUrl
                  ? `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;background:#ffffff;overflow:hidden;">
                       <img src="${safeImageUrl}" alt="${safeChoiceLabel}" style="width:100%;height:100%;object-fit:contain;" />
                     </div>`
                  : `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">No Option Image</div>`
              }
            </div>

            ${
              hasLeather
                ? `<div style="min-width:180px;">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#475569;">LEATHER IMAGE</p>
                    ${
                      safeLeatherImageUrl
                        ? `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;background:#ffffff;overflow:hidden;">
                             <img src="${safeLeatherImageUrl}" alt="${safeLeatherName}" style="width:100%;height:100%;object-fit:contain;" />
                           </div>`
                        : `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">No Leather Image</div>`
                    }
                  </div>`
                : ""
            }

            ${
              hasLaseredBrand
                ? `<div style="min-width:180px;">
                    <p style="margin:0 0 8px 0;font-size:13px;font-weight:700;color:#475569;">LASERED BRAND IMAGE</p>
                    ${
                      safeLaseredBrandImageUrl
                        ? `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;background:#ffffff;overflow:hidden;">
                             <img src="${safeLaseredBrandImageUrl}" alt="Lasered Brand" style="width:100%;height:100%;object-fit:contain;" />
                           </div>`
                        : `<div style="width:180px;height:180px;border-radius:12px;border:2px solid ${color};display:flex;align-items:center;justify-content:center;color:#94a3b8;font-size:12px;">No Brand Image</div>`
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

function buildFactorySelectionsHtml(selections: OrderSelection[]) {
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
      const safeImageUrl = selection.imageUrl ? escapeHtml(selection.imageUrl) : "";
      const safeLeatherImageUrl = selection.leatherImageUrl
        ? escapeHtml(selection.leatherImageUrl)
        : "";
      const safeLaseredBrandImageUrl = selection.laseredBrandImageUrl
        ? escapeHtml(selection.laseredBrandImageUrl)
        : "";

      return `
        <div style="border:1px solid #e5e7eb;border-left:6px solid ${color};border-radius:12px;padding:10px 12px;margin-bottom:10px;background:#ffffff;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:top;padding-right:12px;">
                <div style="display:inline-block;background:${color};color:#ffffff;font-weight:700;font-size:11px;padding:4px 8px;border-radius:999px;margin-bottom:6px;">
                  ${safeGroupName.toUpperCase()}
                </div>
                <div style="font-size:15px;font-weight:700;color:#111827;line-height:1.35;">
                  ${safeChoiceLabel}
                </div>
                ${
                  selection.leatherName
                    ? `<div style="font-size:13px;color:#334155;line-height:1.4;margin-top:4px;">
                        Leather: ${safeLeatherName}${
                          selection.leatherGrade ? ` (${safeLeatherGrade})` : ""
                        }
                      </div>`
                    : ""
                }
                ${
                  selection.isBodyLeather
                    ? `<div style="font-size:13px;color:#334155;line-height:1.4;margin-top:4px;">
                        Body Leather: Yes
                      </div>`
                    : ""
                }
                ${
                  selection.laseredBrand
                    ? `<div style="font-size:13px;color:#334155;line-height:1.4;margin-top:4px;">
                        Lasered Brand: Yes
                      </div>`
                    : ""
                }
              </td>
              <td style="vertical-align:top;width:292px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    ${
                      safeImageUrl
                        ? `<td style="padding-left:8px;">
                            <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;text-align:center;">OPTION</div>
                            <div style="width:84px;height:84px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                              <img
                                src="${safeImageUrl}"
                                alt="${safeChoiceLabel}"
                                style="width:100%;height:100%;object-fit:contain;display:block;"
                              />
                            </div>
                          </td>`
                        : ""
                    }
                    ${
                      safeLeatherImageUrl
                        ? `<td style="padding-left:8px;">
                            <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;text-align:center;">LEATHER</div>
                            <div style="width:84px;height:84px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                              <img
                                src="${safeLeatherImageUrl}"
                                alt="${safeLeatherName || "Leather"}"
                                style="width:100%;height:100%;object-fit:contain;display:block;"
                              />
                            </div>
                          </td>`
                        : ""
                    }
                    ${
                      safeLaseredBrandImageUrl
                        ? `<td style="padding-left:8px;">
                            <div style="font-size:10px;font-weight:700;color:#64748b;margin-bottom:4px;text-align:center;">BRAND</div>
                            <div style="width:84px;height:84px;border-radius:10px;border:1px solid #cbd5e1;background:#ffffff;display:flex;align-items:center;justify-content:center;overflow:hidden;">
                              <img
                                src="${safeLaseredBrandImageUrl}"
                                alt="Lasered Brand"
                                style="width:100%;height:100%;object-fit:contain;display:block;"
                              />
                            </div>
                          </td>`
                        : ""
                    }
                  </tr>
                </table>
              </td>
            </tr>
          </table>
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
    poNumber,
    quantity,
    customerName,
    customerEmail,
    customerPhone,
    notes,
    productName,
    total,
    lineItems = [],
    selections,
  } = input;

  const from = process.env.MAIL_FROM;
  const notifyTo = process.env.ORDER_NOTIFY_TO;

  if (!from || !notifyTo) {
    throw new Error("Missing MAIL_FROM or ORDER_NOTIFY_TO.");
  }

  const transporter = getTransporter();
  const copy = getEmailCopy(type, orderNumber);
  const safeQuantity = sanitizeQuantity(quantity);
  const bodyLeatherSummary = buildBodyLeatherSummary(selections);
  const lineItemsText = buildLineItemsText(lineItems);
  const lineItemsHtml = buildLineItemsHtml(lineItems);

  const internalText = [
    copy.internalSubject,
    "",
    `Order Number: ${orderNumber}`,
    poNumber ? `PO #: ${poNumber}` : "",
    `Quantity: ${safeQuantity}`,
    `Customer: ${customerName}`,
    `Email: ${customerEmail}`,
    customerPhone ? `Phone: ${customerPhone}` : "",
    `Product: ${productName}`,
    bodyLeatherSummary ? `Body Leather: ${bodyLeatherSummary}` : "",
    `Total: ${formatCurrency(total)}`,
    notes ? `Notes: ${notes}` : "",
    lineItemsText ? "" : "",
    lineItemsText ? "ITEMIZED PRICE:" : "",
    lineItemsText || "",
    "",
    "FACTORY SECTIONS:",
    buildFactorySelectionsText(selections),
  ]
    .filter(Boolean)
    .join("\n");

  const internalHtml = `
    <div style="font-family:Arial,sans-serif;max-width:860px;margin:0 auto;padding:14px;background:#f8fafc;color:#111827;">
      <h1 style="margin:0 0 10px 0;font-size:22px;line-height:1.2;">${escapeHtml(
        copy.internalSubject
      )}</h1>

      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:14px 16px;margin-bottom:14px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
          <tr>
            <td style="font-size:14px;line-height:1.55;color:#111827;vertical-align:top;">
              <div><strong>Order Number:</strong> ${escapeHtml(orderNumber)}</div>
              ${poNumber ? `<div><strong>PO #:</strong> ${escapeHtml(poNumber)}</div>` : ""}
              <div><strong>Quantity:</strong> ${safeQuantity}</div>
              <div><strong>Customer:</strong> ${escapeHtml(customerName)}</div>
              <div><strong>Email:</strong> ${escapeHtml(customerEmail)}</div>
              ${
                customerPhone
                  ? `<div><strong>Phone:</strong> ${escapeHtml(customerPhone)}</div>`
                  : ""
              }
              <div><strong>Product:</strong> ${escapeHtml(productName)}</div>
              ${
                bodyLeatherSummary
                  ? `<div><strong>Body Leather:</strong> ${escapeHtml(bodyLeatherSummary)}</div>`
                  : ""
              }
              <div><strong>Total:</strong> ${formatCurrency(total)}</div>
              ${notes ? `<div style="margin-top:6px;"><strong>Notes:</strong> ${escapeHtml(notes)}</div>` : ""}
            </td>
          </tr>
        </table>
      </div>

      ${lineItemsHtml}

      <h2 style="font-size:18px;margin:0 0 10px 0;line-height:1.2;">Factory Sections</h2>
      ${buildFactorySelectionsHtml(selections)}
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
    poNumber ? `PO #: ${poNumber}` : "",
    `Quantity: ${safeQuantity}`,
    `Product: ${productName}`,
    bodyLeatherSummary ? `Body Leather: ${bodyLeatherSummary}` : "",
    `Total: ${formatCurrency(total)}`,
    lineItemsText ? "" : "",
    lineItemsText ? "ITEMIZED PRICE:" : "",
    lineItemsText || "",
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
    <div style="font-family:Arial,sans-serif;max-width:1100px;margin:0 auto;padding:24px;background:#f8fafc;color:#111827;">
      <h1 style="margin:0 0 16px 0;font-size:24px;">${escapeHtml(
        copy.customerSubject
      )}</h1>

      <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:20px;">
        <p>Hello ${escapeHtml(customerName)},</p>
        <p>${escapeHtml(copy.customerIntro)}</p>
        <p><strong>Order Number:</strong> ${escapeHtml(orderNumber)}</p>
        ${poNumber ? `<p><strong>PO #:</strong> ${escapeHtml(poNumber)}</p>` : ""}
        <p><strong>Quantity:</strong> ${safeQuantity}</p>
        <p><strong>Product:</strong> ${escapeHtml(productName)}</p>
        ${
          bodyLeatherSummary
            ? `<p><strong>Body Leather:</strong> ${escapeHtml(bodyLeatherSummary)}</p>`
            : ""
        }
        <p><strong>Total:</strong> ${formatCurrency(total)}</p>
        ${notes ? `<p><strong>Notes:</strong> ${escapeHtml(notes)}</p>` : ""}
      </div>

      ${lineItemsHtml}

      <h2 style="font-size:22px;margin:0 0 16px 0;">Selections</h2>
      ${buildCustomerSelectionsHtml(selections)}

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