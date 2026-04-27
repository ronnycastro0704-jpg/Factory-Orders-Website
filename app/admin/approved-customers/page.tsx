import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import ApprovedCustomerForm from "./approved-customer-form";
import ApprovedCustomerRowActions from "./approved-customer-row-actions";

export default async function ApprovedCustomersPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/my/orders");
  }

  const approvedCustomers = await prisma.approvedCustomer.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">
          Approved Customers
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage which customer emails can create accounts and place orders.
        </p>
      </div>

      <div className="mb-8 rounded-xl border bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Add approved customer
        </h2>
        <ApprovedCustomerForm />
      </div>

      <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {approvedCustomers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                  No approved customers yet.
                </td>
              </tr>
            ) : (
              approvedCustomers.map((customer) => (
                <tr key={customer.id} className="border-b last:border-b-0">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {customer.name}
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {customer.email}
                  </td>
                  <td className="px-4 py-3">
                    {customer.active ? (
                      <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                        Active
                      </span>
                    ) : (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <ApprovedCustomerRowActions customer={customer} />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}