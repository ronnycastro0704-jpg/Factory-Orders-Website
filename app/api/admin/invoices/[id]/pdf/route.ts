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

export async function GET(_request: Request, context: RouteContext) {
  try {
    const session = await auth();

    if (!session?.user?.email || !isAdminEmail(session.user.email)) {
      return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
    }

    const { id } = await context.params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        orders: {
          orderBy: {
            createdAt: "asc",
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json(
        { error: "Invoice not found." },
        { status: 404 }
      );
    }

    const pdfBuffer = await buildInvoicePdfBuffer(invoice);

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (error) {
    console.error("INVOICE PDF ERROR:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice PDF." },
      { status: 500 }
    );
  }
}