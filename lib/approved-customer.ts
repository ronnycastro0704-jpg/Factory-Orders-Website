import { prisma } from "./prisma";

export type ApprovedCustomer = {
  email: string;
  name: string;
  retailMultiplier: number;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

function normalizeRetailMultiplier(value: unknown) {
  const parsed = Number(value || 1);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 1;
  }

  return Math.round((parsed + Number.EPSILON) * 100) / 100;
}

export async function getApprovedCustomerProfile(email?: string | null) {
  if (!email) return null;

  const customer = await prisma.approvedCustomer.findFirst({
    where: {
      email: normalizeEmail(email),
      active: true,
    },
    select: {
      email: true,
      name: true,
      retailMultiplier: true,
    },
  });

  if (!customer) return null;

  return {
    email: normalizeEmail(customer.email),
    name: customer.name.trim(),
    retailMultiplier: normalizeRetailMultiplier(customer.retailMultiplier),
  };
}

export async function isApprovedCustomerEmail(email?: string | null) {
  return Boolean(await getApprovedCustomerProfile(email));
}

export async function getApprovedCustomerEmails() {
  const customers = await prisma.approvedCustomer.findMany({
    where: {
      active: true,
    },
    select: {
      email: true,
    },
    orderBy: {
      email: "asc",
    },
  });

  return customers.map((customer) => normalizeEmail(customer.email));
}