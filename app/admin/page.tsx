import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ClipboardList,
  Factory,
  Package,
  Palette,
  UserCheck,
} from "lucide-react";
import { auth } from "../../auth";
import { isAdminEmail } from "../../lib/admin";
import { prisma } from "../../lib/prisma";

const adminLinks = [
  {
    title: "Dashboard",
    description: "Open the factory production dashboard.",
    href: "/admin/production",
    icon: Factory,
  },
  {
    title: "Orders",
    description: "Search and review customer orders.",
    href: "/admin/orders",
    icon: ClipboardList,
  },
  {
    title: "Products",
    description: "Manage products, option groups, and choices.",
    href: "/admin/products",
    icon: Package,
  },
  {
    title: "Leathers",
    description: "Manage leather options and inventory.",
    href: "/admin/leathers",
    icon: Palette,
  },
  {
    title: "Approved Customers",
    description: "Add or remove customer emails allowed to create accounts.",
    href: "/admin/approved-customers",
    icon: UserCheck,
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

  const [
    totalOrders,
    changedOrders,
    paidOrders,
    activeProductionLines,
    approvedCustomers,
  ] = await Promise.all([
    prisma.order.count(),
    prisma.order.count({ where: { status: "CHANGED" } }),
    prisma.order.count({ where: { status: "PAID" } }),
    prisma.productionLine.count({
      where: {
        order: {
          status: {
            notIn: ["PAID", "CANCELLED"],
          },
        },
      },
    }),
    prisma.approvedCustomer.count({
      where: {
        active: true,
      },
    }),
  ]);

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell space-y-8">
        <section className="page-header">
          <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
            Admin
          </p>

          <h1 className="text-4xl font-bold sm:text-5xl">
            Admin Control Center
          </h1>

          <p className="mt-4 max-w-2xl text-base sm:text-lg text-slate-600">
            Manage orders, production, products, leathers, and approved customer
            access from one place.
          </p>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Total Orders
            </p>
            <p className="mt-3 text-4xl font-bold">{totalOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Changed
            </p>
            <p className="mt-3 text-4xl font-bold">{changedOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Paid
            </p>
            <p className="mt-3 text-4xl font-bold">{paidOrders}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Active Lines
            </p>
            <p className="mt-3 text-4xl font-bold">{activeProductionLines}</p>
          </div>

          <div className="section-card-strong">
            <p className="text-xs uppercase tracking-[0.16em] text-slate-500">
              Approved Customers
            </p>
            <p className="mt-3 text-4xl font-bold">{approvedCustomers}</p>
          </div>
        </section>

        <section className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {adminLinks.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                className="section-card-strong group transition hover:-translate-y-1 hover:shadow-lg"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-soft)] text-[var(--brand)]">
                  <Icon className="h-6 w-6" />
                </div>

                <h2 className="text-2xl font-semibold">{item.title}</h2>

                <p className="mt-3 min-h-[48px] text-sm leading-6 text-slate-600">
                  {item.description}
                </p>

                <p className="mt-6 text-sm font-semibold text-slate-900 group-hover:text-[var(--brand)]">
                  Open →
                </p>
              </Link>
            );
          })}
        </section>
      </div>
    </main>
  );
}