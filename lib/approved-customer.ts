export type ApprovedCustomer = {
  email: string;
  name: string;
};

function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export const APPROVED_CUSTOMERS: ApprovedCustomer[] = [
  {
    email: "ianmejiascastro@gmail.com",
    name: "Ian",
  },

  // Add more here:
  // { email: "ronny@example.com", name: "Ronny" },
  // { email: "client@example.com", name: "Client Name" },
];

const approvedCustomerMap = new Map(
  APPROVED_CUSTOMERS.map((customer) => [
    normalizeEmail(customer.email),
    {
      email: normalizeEmail(customer.email),
      name: customer.name.trim(),
    },
  ])
);

export function getApprovedCustomerProfile(email?: string | null) {
  if (!email) return null;
  return approvedCustomerMap.get(normalizeEmail(email)) || null;
}

export function isApprovedCustomerEmail(email?: string | null) {
  return Boolean(getApprovedCustomerProfile(email));
}

export function getApprovedCustomerEmails() {
  return APPROVED_CUSTOMERS.map((customer) =>
    normalizeEmail(customer.email)
  );
}