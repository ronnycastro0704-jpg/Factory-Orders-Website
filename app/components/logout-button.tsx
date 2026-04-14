"use client";

import { signOut } from "next-auth/react";

export default function LogoutButton() {
  return (
    <button
      type="button"
      onClick={() => signOut({ callbackUrl: "/login" })}
      className="rounded-lg border px-3 py-2 text-sm hover:bg-slate-100"
    >
      Log out
    </button>
  );
}