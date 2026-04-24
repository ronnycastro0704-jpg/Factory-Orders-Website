import { google } from "googleapis";

type SheetPartInput = {
  partNumber: string;
  frameNeeded: string;
};

type SheetRowInput = {
  poNumber?: string | null;
  customerName: string;
  bodyLeather?: string | null;
  dateSold?: string | Date | null;
  dueDate?: string | Date | null;
  quantity: number;
  parts: SheetPartInput[];
};

type QuantityLedgerPartInput = {
  partNumber: string;
  frameNeeded: string;
  qtyChange: number;
};

type QuantityLedgerRowInput = {
  orderNumber: string;
  poNumber?: string | null;
  customerName: string;
  reason: string;
  source?: string | null;
  parts: QuantityLedgerPartInput[];
};

type ProductionStageStatus =
  | "NOT_STARTED"
  | "IN_PROGRESS"
  | "DONE"
  | "BLOCKED"
  | "NA";

type ProductionTrackingRowInput = {
  poNumber?: string | null;
  customerName: string;
  partNumber: string;
  frameNeeded: string;
  quantity: number;
  bodyLeather?: string | null;
  dueDate?: string | Date | null;

  millFirstStatus: ProductionStageStatus;
  leatherOrderedStatus: ProductionStageStatus;
  millStatus: ProductionStageStatus;
  frameAssemblyStatus: ProductionStageStatus;
  leatherArrivedStatus: ProductionStageStatus;
  leaCutStatus: ProductionStageStatus;
  sewnStatus: ProductionStageStatus;
  upholsteryStatus: ProductionStageStatus;
  upholsteredStatus: ProductionStageStatus;
  finalAssemblyStatus: ProductionStageStatus;
  qcStatus: ProductionStageStatus;

  upholsteryAssignedTo?: string | null;
  upholsteredAssignedTo?: string | null;
  finalAssemblyAssignedTo?: string | null;
  qcAssignedTo?: string | null;

  pickedUp: boolean;
  pickedUpAt?: string | Date | null;
};

type UpdateProductionTrackingRowResult = {
  updated: boolean;
  worksheetName: string;
  rowNumber: number | null;
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

function formatDate(value?: string | Date | null) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
}

function formatDateSold(value?: string | Date | null) {
  const formatted = formatDate(value);

  if (formatted) {
    return formatted;
  }

  const fallback = new Date();
  return `${fallback.getMonth() + 1}/${fallback.getDate()}/${fallback.getFullYear()}`;
}

function formatTimestamp(value?: string | Date | null) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return new Date().toISOString();
  }

  return date.toISOString();
}

function sanitizeQuantity(value: number | null | undefined) {
  const parsed = Number(value ?? 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.max(1, Math.round(parsed));
}

function normalizeCell(value: string | undefined) {
  return String(value || "").trim().toLowerCase();
}

function padRow(values: string[], targetLength: number) {
  const next = [...values];

  while (next.length < targetLength) {
    next.push("");
  }

  return next;
}

function formatStageStatus(value: ProductionStageStatus) {
  switch (value) {
    case "NOT_STARTED":
      return "Not Started";
    case "IN_PROGRESS":
      return "In Progress";
    case "DONE":
      return "Done";
    case "BLOCKED":
      return "Blocked";
    case "NA":
      return "N/A";
    default:
      return "";
  }
}

function formatAssignedOrStatus(
  assignedTo: string | null | undefined,
  status: ProductionStageStatus
) {
  const assignee = String(assignedTo || "").trim();
  return assignee || formatStageStatus(status);
}

function formatPickedUpValue(
  pickedUp: boolean,
  pickedUpAt?: string | Date | null
) {
  if (!pickedUp) {
    return "";
  }

  const formattedDate = formatDate(pickedUpAt);
  return formattedDate || "Yes";
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
  const dueDate = formatDate(input.dueDate);
  const quantity = sanitizeQuantity(input.quantity);

  const rows = input.parts.map((part) => [
    input.poNumber || "",
    input.customerName,
    part.partNumber || "",
    part.frameNeeded || "",
    quantity,
    dateSold,
    dueDate,
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

export async function appendQuantityLedgerRows(input: QuantityLedgerRowInput) {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName =
    process.env.GOOGLE_SHEETS_QUANTITY_LEDGER_TAB_NAME || "Quantity Ledger";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }

  if (!input.parts || input.parts.length === 0) {
    throw new Error("No quantity ledger rows were provided for Google Sheets.");
  }

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const timestamp = formatTimestamp();

  const rows = input.parts.map((part) => [
    timestamp,
    input.orderNumber,
    input.poNumber || "",
    input.customerName,
    part.partNumber || "",
    part.frameNeeded || "",
    Number(part.qtyChange || 0),
    input.reason,
    input.source || "website",
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

export async function updateProductionTrackingRow(
  input: ProductionTrackingRowInput
): Promise<UpdateProductionTrackingRowResult> {
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;
  const tabName = process.env.GOOGLE_SHEETS_TAB_NAME || "Orders";

  if (!spreadsheetId) {
    throw new Error("Missing GOOGLE_SHEETS_SPREADSHEET_ID.");
  }

  const auth = getGoogleAuth();
  const sheets = google.sheets({ version: "v4", auth });

  const readResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `${tabName}!A:T`,
  });

  const rows = readResponse.data.values || [];

  if (rows.length <= 1) {
    return {
      updated: false,
      worksheetName: tabName,
      rowNumber: null,
    };
  }

  const targetPart = normalizeCell(input.partNumber);
  const targetFrame = normalizeCell(input.frameNeeded);
  const targetPo = normalizeCell(input.poNumber || "");
  const targetCustomer = normalizeCell(input.customerName);

  let bestRowIndex = -1;
  let bestScore = -1;

  for (let i = 1; i < rows.length; i += 1) {
    const row = rows[i] || [];
    const rowPo = normalizeCell(row[0]);
    const rowCustomer = normalizeCell(row[1]);
    const rowPart = normalizeCell(row[2]);
    const rowFrame = normalizeCell(row[3]);

    if (rowPart !== targetPart || rowFrame !== targetFrame) {
      continue;
    }

    if (targetPo) {
      if (rowPo !== targetPo) {
        continue;
      }

      let score = 2;
      if (rowCustomer === targetCustomer) {
        score += 1;
      }

      if (score > bestScore) {
        bestScore = score;
        bestRowIndex = i;
      }

      continue;
    }

    if (rowCustomer !== targetCustomer) {
      continue;
    }

    if (1 > bestScore) {
      bestScore = 1;
      bestRowIndex = i;
    }
  }

  if (bestRowIndex === -1) {
    return {
      updated: false,
      worksheetName: tabName,
      rowNumber: null,
    };
  }

  const currentRow = padRow(rows[bestRowIndex].map((value) => String(value)), 20);
  const rowNumber = bestRowIndex + 1;
  const dueDate = formatDate(input.dueDate);
  const quantity = sanitizeQuantity(input.quantity);

  currentRow[0] = input.poNumber || "";
  currentRow[1] = input.customerName;
  currentRow[2] = input.partNumber;
  currentRow[3] = input.frameNeeded;
  currentRow[4] = String(quantity);
  currentRow[6] = dueDate;
  currentRow[7] = formatStageStatus(input.millFirstStatus);
  currentRow[8] = input.bodyLeather || "";
  currentRow[9] = formatStageStatus(input.leatherOrderedStatus);
  currentRow[10] = formatStageStatus(input.millStatus);
  currentRow[11] = formatStageStatus(input.frameAssemblyStatus);
  currentRow[12] = formatStageStatus(input.leatherArrivedStatus);
  currentRow[13] = formatStageStatus(input.leaCutStatus);
  currentRow[14] = formatStageStatus(input.sewnStatus);
  currentRow[15] = formatAssignedOrStatus(
    input.upholsteryAssignedTo,
    input.upholsteryStatus
  );
  currentRow[16] = formatAssignedOrStatus(
    input.upholsteredAssignedTo,
    input.upholsteredStatus
  );
  currentRow[17] = formatAssignedOrStatus(
    input.finalAssemblyAssignedTo,
    input.finalAssemblyStatus
  );
  currentRow[18] = formatAssignedOrStatus(input.qcAssignedTo, input.qcStatus);
  currentRow[19] = formatPickedUpValue(input.pickedUp, input.pickedUpAt);

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${tabName}!A${rowNumber}:T${rowNumber}`,
    valueInputOption: "USER_ENTERED",
    requestBody: {
      values: [currentRow.slice(0, 20)],
    },
  });

  return {
    updated: true,
    worksheetName: tabName,
    rowNumber,
  };
}