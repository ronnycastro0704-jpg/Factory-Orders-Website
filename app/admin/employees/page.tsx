import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { isAdminEmail } from "../../../lib/admin";
import { prisma } from "../../../lib/prisma";
import EmployeeForm from "./employee-form";
import EmployeeRowActions from "./employee-row-actions";

export default async function AdminEmployeesPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/my/orders");
  }

  const employees = await prisma.employee.findMany({
    orderBy: [{ active: "desc" }, { department: "asc" }, { name: "asc" }],
  });

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell space-y-8">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Admin Employees
              </p>

              <h1 className="text-4xl font-bold sm:text-5xl">
                Production Employees
              </h1>

              <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                Add employees and assign them to departments. Upholstery
                employees will be used for upholstery payroll and assignment
                dropdowns.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/admin" className="button-secondary">
                ← Dashboard
              </Link>
              <Link href="/admin/production" className="button-secondary">
                Production
              </Link>
            </div>
          </div>
        </section>

        <section className="section-card-strong">
          <h2 className="text-2xl font-bold">Add Employee</h2>
          <div className="mt-5">
            <EmployeeForm />
          </div>
        </section>

        <section className="section-card-strong">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
                Employees
              </p>
              <h2 className="mt-2 text-3xl font-bold">Employee List</h2>
            </div>

            <span className="status-pill">
              {employees.length} employee{employees.length === 1 ? "" : "s"}
            </span>
          </div>

          {employees.length === 0 ? (
            <div className="rounded-2xl border border-dashed bg-white/70 p-10 text-center text-sm text-slate-500">
              No employees yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase tracking-[0.12em] text-slate-500">
                    <th className="py-3 pr-4">Name</th>
                    <th className="py-3 pr-4">Department</th>
                    <th className="py-3 pr-4">Status</th>
                    <th className="py-3 pr-4 text-right">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {employees.map((employee) => (
                    <tr key={employee.id} className="border-b last:border-0">
                      <td className="py-4 pr-4 font-semibold">
                        {employee.name}
                      </td>

                      <td className="py-4 pr-4">
                        {employee.department.replaceAll("_", " ")}
                      </td>

                      <td className="py-4 pr-4">
                        {employee.active ? (
                          <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-medium text-green-700">
                            Active
                          </span>
                        ) : (
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                            Inactive
                          </span>
                        )}
                      </td>

                      <td className="py-4 pr-4 text-right">
                        <EmployeeRowActions
                          employee={{
                            id: employee.id,
                            name: employee.name,
                            department: employee.department,
                            active: employee.active,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}