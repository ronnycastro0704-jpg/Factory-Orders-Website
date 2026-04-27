"use client";

import { signIn } from "next-auth/react";
import { FormEvent, useState } from "react";

export default function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setLoading(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account.");
        setLoading(false);
        return;
      }

      setSuccess("Account created. Signing you in...");

      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        setError("Account created, but automatic login failed.");
        setLoading(false);
        return;
      }

      window.location.href = "/my/orders";
    } catch (error) {
      console.error(error);
      setError("Failed to create account.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium">Email</label>
        <input
          type="email"
          className="w-full rounded-lg border px-3 py-2"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="approved@email.com"
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Use the email address your account was approved with.
        </p>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium">Create password</label>
        <input
          type="password"
          className="w-full rounded-lg border px-3 py-2"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          minLength={8}
          required
        />
        <p className="mt-1 text-xs text-slate-500">
          Password must be at least 8 characters.
        </p>
      </div>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {success ? <p className="text-sm text-green-600">{success}</p> : null}

      <button
        type="submit"
        disabled={loading}
        className="w-full rounded-lg bg-slate-900 px-4 py-2 text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {loading ? "Creating..." : "Create account"}
      </button>
    </form>
  );
}