import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../auth";
import { isAdminEmail } from "../../lib/admin";

const adminLinks = [
  {
    title: "Dashboard",
    description: "Open the factory production dashboard.",
    href: "/admin/production",
  },
  {
    title: "Orders",
    description: "Search and review customer orders.",
    href: "/admin/orders",
  },
  {
    title: "Products",
    description: "Manage products, option groups, and choices.",
    href: "/admin/products",
  },
  {
    title: "Leathers",
    description: "Manage leather options and inventory.",
    href: "/admin/leathers",
  },
  {
    title: "Approved Customers",
    description: "Add or remove customer emails allowed to create accounts.",
    href: "/admin/approved-customers",
  },
];

export default async function AdminPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  if (!isAdminEmail(session.user.email)) {
    redirect("/my/orders");
  }

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-6xl space-y-8">
        <section className="rounded-2xl border bg-white p-8 shadow-sm">
          <p className="text-sm font-medium uppercase tracking-[0.18em] text-slate-500">
            Admin
          </p>
          <h1 className="mt-3 text-4xl font-bold">Admin Control Center</h1>
          <p className="mt-3 max-w-2xl text-slate-600">
            Choose where you want to go next.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {adminLinks.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-2xl border bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <h2 className="text-2xl font-semibold">{item.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                {item.description}
              </p>
              <p className="mt-6 text-sm font-semibold text-slate-900">
                Open →
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}