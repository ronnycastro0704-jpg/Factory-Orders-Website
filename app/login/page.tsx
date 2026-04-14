import LoginForm from "./login-form";

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold">Log in</h1>
        <p className="mt-2 text-slate-600">
          Sign in to access your saved orders.
        </p>

        <div className="mt-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}