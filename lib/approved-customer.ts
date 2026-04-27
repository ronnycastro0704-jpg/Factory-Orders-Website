import { prisma } from "./prisma";

export type ApprovedCustomer = {
  email: string;
  name: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
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
    },
  });

  if (!customer) return null;

  return {
    email: normalizeEmail(customer.email),
    name: customer.name.trim(),
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