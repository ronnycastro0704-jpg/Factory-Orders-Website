import nodemailer from "nodemailer";
import { NextResponse } from "next/server";
import { auth } from "../../../../../../auth";
import { isAdminEmail } from "../../../../../../lib/admin";
import { buildInvoicePdfBuffer } from "../../../../../../lib/invoice-pdf";
import { prisma } from "../../../../../../lib/prisma";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
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

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
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

export async function POST(_request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const from = process.env.MAIL_FROM;

    if (!from) {
      return NextResponse.json(
        { error: "Missing MAIL_FROM environment variable." },
        { status: 500 }
      );
    }

    const { id } = await context.params;

const invoice = await prisma.invoice.findUnique({
  where: { id },
  include: {
    extraCharges: {
      orderBy: {
        createdAt: "asc",
      },
    },
    orders: {
      orderBy: {
        createdAt: "asc",
      },
    },
  }, 
}); //trying to push to github

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    const pdfBuffer = await buildInvoicePdfBuffer(invoice);
    const transporter = getTransporter();

    const subject = `Invoice ${invoice.invoiceNumber} - ${formatCurrency(
      Number(invoice.total || 0)
    )}`;

    const text = [
      `Hello ${invoice.customerName},`,
      "",
      `Please find attached invoice ${invoice.invoiceNumber}.`,
      "",
      `Amount Due: ${formatCurrency(Number(invoice.total || 0))}`,
      `Due Date: ${formatDate(invoice.dueAt)}`,
      `Terms: ${invoice.terms}`,
      "",
      "Thank you.",
    ].join("\n");

    const html = `
      <div style="font-family:Arial,sans-serif;max-width:680px;margin:0 auto;padding:24px;background:#f8fafc;color:#111827;">
        <div style="background:white;border:1px solid #e5e7eb;border-radius:14px;padding:22px;">
          <h1 style="margin:0 0 12px 0;font-size:24px;">Invoice ${escapeHtml(
            invoice.invoiceNumber
          )}</h1>

          <p>Hello ${escapeHtml(invoice.customerName)},</p>

          <p>Please find your invoice attached as a PDF.</p>

          <div style="margin:20px 0;padding:16px;border-radius:12px;background:#f1f5f9;">
            <p style="margin:0 0 8px 0;"><strong>Amount Due:</strong> ${formatCurrency(
              Number(invoice.total || 0)
            )}</p>
            <p style="margin:0 0 8px 0;"><strong>Due Date:</strong> ${escapeHtml(
              formatDate(invoice.dueAt)
            )}</p>
            <p style="margin:0;"><strong>Terms:</strong> ${escapeHtml(
              invoice.terms
            )}</p>
          </div>

          <p>Thank you.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from,
      to: invoice.customerEmail,
      subject,
      text,
      html,
      attachments: [
        {
          filename: `${invoice.invoiceNumber}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: invoice.status === "DRAFT" ? "ISSUED" : invoice.status,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("EMAIL INVOICE ERROR:", error);
    return NextResponse.json(
      { error: "Failed to email invoice." },
      { status: 500 }
    );
  }
}