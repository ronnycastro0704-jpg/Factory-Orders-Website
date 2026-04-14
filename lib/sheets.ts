import { google } from "googleapis";

type SheetRowInput = {
  eventType: "created" | "updated";
  orderNumber: string;
  status: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  productName: string;
  total: number;
  notes?: string | null;
  selectionsText: string;
};

function getGoogleAuth() {
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!clientEmail || !privateKey) {
    throw new Error("Missing Google service account env vars.");
  }

  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
}

export async function appendOrderRow(input: SheetRowInput) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || "Orders";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const row = [
    new Date().toISOString(),
    input.eventType,
    input.orderNumber,
    input.status,
    input.customerName,
    input.customerEmail,
    input.customerPhone || "",
    input.productName,
    input.total,
    input.notes || "",
    input.selectionsText,
  ];

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:K`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [row],
    },
  });
}