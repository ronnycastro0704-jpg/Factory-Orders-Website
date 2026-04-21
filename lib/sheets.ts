import { google } from "googleapis";

type SheetPartInput = {
  partNumber: string;
  frameNeeded?: string | null;
  quantity: number;
};

type SheetRowInput = {
  poNumber?: string | null;
  customerName: string;
  bodyLeather?: string | null;
  dateSold?: string | Date | null;
  parts: SheetPartInput[];
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

function formatDateSold(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    const fallback = new Date();
    return `${fallback.getMonth() + 1}/${fallback.getDate()}/${fallback.getFullYear()}`;
  }

  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

export async function appendOrderRow(input: SheetRowInput) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || "Orders";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }

  if (!input.parts || input.parts.length === 0) {
    throw new Error("No parts were provided for Google Sheets.");
  }

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const dateSold = formatDateSold(input.dateSold);

  const rows = input.parts.map((part) => [
    input.poNumber || "",
    input.customerName,
    part.partNumber || "",
    part.frameNeeded || "",
    Number(part.quantity || 0),
    dateSold,
    "", // Due Date
    "", // MILL FIRST
    input.bodyLeather || "",
  ]);

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: `${tabName}!A:I`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: rows,
    },
  });
}