import Link from "next/link";
import LoginForm from "./login-form";

type PageProps = {
  searchParams: Promise<{
    callbackUrl?: string;
  }>;
};

export default async function LoginPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const callbackUrl = params.callbackUrl || "/my/orders";

  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold">Log in</h1>
        <p className="mt-2 text-slate-600">
          Sign in to access your saved orders.
        </p>

        <div className="mt-6">
          <LoginForm callbackUrl={callbackUrl} />
        </div>

        <div className="mt-6 border-t pt-4 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link href="/signup" className="font-medium text-slate-900 underline">
            Create account
          </Link>
        </div>
      </div>
    </main>
  );
}