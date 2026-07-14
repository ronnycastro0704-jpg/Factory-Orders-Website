import Link from "next/link";
import ResetPasswordForm from "./reset-password-form";

type PageProps = {
  params: Promise<{
    token: string;
  }>;
};

export default async function ResetPasswordPage({ params }: PageProps) {
  const { token } = await params;

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold">Reset password</h1>
        <p className="mt-2 text-slate-600">
          Choose a new password for your account.
        </p>

        <div className="mt-6">
          <ResetPasswordForm token={token} />
        </div>

        <div className="mt-6 border-t pt-4 text-center text-sm text-slate-600">
          Back to{" "}
          <Link href="/login" className="font-medium text-slate-900 underline">
            login
          </Link>
        </div>
      </div>
    </main>
  );
}