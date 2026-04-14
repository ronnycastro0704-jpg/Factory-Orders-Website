import SignupForm from "./signup-form";

export default function SignupPage() {
  return (
    <main className="min-h-screen bg-slate-50 p-8 text-slate-900">
      <div className="mx-auto max-w-md rounded-2xl border bg-white p-6 shadow-sm">
        <p className="text-sm text-slate-500">Account</p>
        <h1 className="mt-2 text-3xl font-bold">Create account</h1>
        <p className="mt-2 text-slate-600">
          Create an account to save and edit your orders.
        </p>

        <div className="mt-6">
          <SignupForm />
        </div>
      </div>
    </main>
  );
}