import Link from "next/link";
import { auth } from "../../auth";
import LogoutButton from "./logout-button";

export default async function SiteHeader() {
  const session = await auth();

  const user = session?.user;
  const role = user?.role;

  return (
    <header className="border-b bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold text-slate-900">
            Furniture Orders
          </Link>

          <nav className="flex items-center gap-3 text-sm text-slate-600">
            <Link href="/" className="hover:text-slate-900">
              Builder
            </Link>

            {user ? (
              <>
                <Link href="/my/orders" className="hover:text-slate-900">
                  My Orders
                </Link>

  {(role === "ADMIN" || role === "STAFF") ? (
  <>
    <Link href="/admin" className="hover:text-slate-900">
      Admin Dashboard
    </Link>
    <Link href="/admin/products" className="hover:text-slate-900">
      Products
    </Link>
    <Link href="/admin/leathers" className="hover:text-slate-900">
      Leathers
    </Link>
    <Link href="/admin/approved-customers" className="hover:text-slate-900">
      Approved Customers
    </Link>
    <Link href="/admin/orders" className="hover:text-slate-900">
      Orders
    </Link>
  </>
) : null}
              </>
            ) : null}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <div className="text-right">
                <p className="text-sm font-medium text-slate-900">
                  {user.name || "User"}
                </p>
                <p className="text-xs text-slate-500">
                  {user.email} • {role}
                </p>
              </div>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
              >
                Log in
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-slate-900 px-3 py-2 text-sm text-white hover:bg-slate-800"
              >
                Sign up
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}