import { NextResponse } from "next/server";
import { auth } from "./auth";
import { isAdminEmail } from "./lib/admin";

export default auth((req) => {
  const pathname = req.nextUrl.pathname;
  const userEmail = req.auth?.user?.email || null;
  const isLoggedIn = Boolean(userEmail);
  const isAdmin = isAdminEmail(userEmail);

  const isLoginRoute = pathname === "/login";
  const isAdminRoute = pathname === "/admin" || pathname.startsWith("/admin/");
  const isMyOrdersRoute =
    pathname === "/my/orders" || pathname.startsWith("/my/orders/");
  const isCustomerOrderEditRoute =
    pathname.startsWith("/orders/") && pathname.endsWith("/edit");

  if (isLoginRoute && isLoggedIn) {
    return NextResponse.redirect(
      new URL(isAdmin ? "/admin/products" : "/my/orders", req.url)
    );
  }

  if ((isAdminRoute || isMyOrdersRoute || isCustomerOrderEditRoute) && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  if (isAdminRoute && !isAdmin) {
    return NextResponse.redirect(new URL("/my/orders", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/login", "/admin/:path*", "/my/orders/:path*", "/orders/:path*/edit"],
};