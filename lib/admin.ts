export function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

export function getAdminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);
}

export function isAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  return getAdminEmails().includes(normalized);
}