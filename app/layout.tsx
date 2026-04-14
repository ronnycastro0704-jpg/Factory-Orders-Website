import type { Metadata } from "next";
import { SessionProvider } from "next-auth/react";
import "./globals.css";
import SiteHeader from "./components/site-header";

export const metadata: Metadata = {
  title: "Furniture Orders",
  description: "Custom furniture ordering platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-slate-900">
        <SessionProvider>
          <SiteHeader />
          {children}
        </SessionProvider>
      </body>
    </html>
  );
}