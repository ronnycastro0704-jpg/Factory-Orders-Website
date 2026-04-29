import { auth } from "./auth";
import { NextResponse } from "next/server";

function normalizeEmail(value?: string | null) {
  return (value || "").trim().toLowerCase();
}

function isAdminEmail(email?: string | null) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  const adminEmails = (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((value) => normalizeEmail(value))
    .filter(Boolean);

  return adminEmails.includes(normalized);
}

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const userEmail = req.auth?.user?.email || null;
  const isLoggedIn = Boolean(userEmail);
  const isAdmin = isAdminEmail(userEmail);

  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isCustomerRoute =
    pathname === "/my/orders" ||
    pathname.startsWith("/my/orders/") ||
    (pathname.startsWith("/orders/") && pathname.endsWith("/edit"));

if (isLoginRoute && isLoggedIn) {
  return NextResponse.redirect(
    new URL(isAdmin ? "/admin" : "/my/orders", req.url)
  );
}

  if ((isAdminRoute || isCustomerRoute) && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/my/orders", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/login", "/admin/:path*", "/my/orders/:path*", "/orders/:path*/edit"],
};