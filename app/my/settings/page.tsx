import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "../../../auth";
import { getApprovedCustomerProfile } from "../../../lib/approved-customer";
import RetailMultiplierForm from "./retail-multiplier-form";

export default async function MySettingsPage() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  const approvedCustomer = await getApprovedCustomerProfile(session.user.email);

  if (!approvedCustomer) {
    redirect("/my/orders");
  }

  return (
    <main className="min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="page-shell">
        <section className="page-header">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="mb-3 inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
                Store Settings
              </p>

              <h1 className="text-4xl font-bold sm:text-5xl">
                Retail Display Settings
              </h1>

              <p className="mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
                Set the retail multiplier your store wants to show on the product
                builder. This only changes displayed prices and retail printouts.
                It does not change submitted wholesale order totals.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/" className="button-secondary">
                ← Builder
              </Link>
              <Link href="/my/orders" className="button-secondary">
                My Orders
              </Link>
            </div>
          </div>
        </section>

        <section className="section-card-strong max-w-2xl">
          <RetailMultiplierForm
            initialRetailMultiplier={approvedCustomer.retailMultiplier}
          />
        </section>
      </div>
    </main>
  );
}