import Link from "next/link";
import ForgotPasswordForm from "./forgot-password-form";

export default function ForgotPasswordPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold">Forgot password</h1>
        <p className="mt-2 text-slate-600">
          Enter your approved customer email and we&apos;ll send a password reset
          link if an account exists.
        </p>

        <div className="mt-6">
          <ForgotPasswordForm />
        </div>

        <div className="mt-6 border-t pt-4 text-center text-sm text-slate-600">
          Remember your password?{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            Log in
          </Link>
        </div>
      </div>
    </main>
  );
}