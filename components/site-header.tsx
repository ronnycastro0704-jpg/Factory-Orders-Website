import Link from "next/link";
import { auth, signOut } from "@/auth";
import { isAdminEmail } from "@/lib/admin";

export default async function SiteHeader() {
  const session = await auth();
  const email = session?.user?.email || null;
  const name = session?.user?.name || email || "Account";
  const showAdmin = isAdminEmail(email);

  return (
    <header className="sticky top-0 z-50 border-b bg-white/85 backdrop-blur">
      <div className="page-shell">
        <div className="flex min-h-[72px] flex-col gap-3 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/"
              className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm hover:bg-slate-50"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--brand)] text-sm font-bold text-white">
                FO
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  Furniture Orders
                </p>
                <p className="text-xs text-slate-500">
                  Customer + Factory Platform
                </p>
              </div>
            </Link>

            <nav className="hidden items-center gap-2 md:flex">
              <Link href="/" className="button-secondary">
                Customer Side
              </Link>

              <Link href="/my/orders" className="button-secondary">
                My Orders
              </Link>

              {showAdmin ? (
                <Link href="/admin" className="button-primary">
                  Open Admin
                </Link>
              ) : null}
            </nav>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {session?.user ? (
              <>
                <div className="rounded-xl border bg-white px-3 py-2 text-sm shadow-sm">
                  <p className="font-medium text-slate-900">{name}</p>
                  {email ? (
                    <p className="text-xs text-slate-500">{email}</p>
                  ) : null}
                </div>

                <form
                  action={async () => {
                    "use server";
                    await signOut({ redirectTo: "/login" });
                  }}
                >
                  <button type="submit" className="button-primary">
                    Sign Out
                  </button>
                </form>
              </>
            ) : (
              <Link href="/login" className="button-primary">
                Sign In
              </Link>
            )}
          </div>

          <nav className="flex flex-wrap items-center gap-2 md:hidden">
            <Link href="/" className="button-secondary">
              Customer Side
            </Link>

            <Link href="/my/orders" className="button-secondary">
              My Orders
            </Link>

            {showAdmin ? (
              <Link href="/admin" className="button-primary">
                Open Admin
              </Link>
            ) : null}
          </nav>
        </div>
      </div>
    </header>
  );
}