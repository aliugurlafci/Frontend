"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const router = useRouter();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
            A
          </div>
          <span className="text-2xl font-bold tracking-tight">Aula CRM</span>
        </div>

        <h1 className="text-2xl font-bold">Forgot Password?</h1>
        <p className="mt-1 text-sm text-muted">
          Enter your email to receive a reset link.
        </p>

        <form
          className="mt-7 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/reset-password");
          }}
        >
          {/* Email */}
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
              Email Address
            </label>
            <div className="relative">
              <input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
            </div>
          </div>

          <button
            type="submit"
            className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Send Reset Link
          </button>
        </form>

        <p className="mt-5 text-sm text-muted">
          <Link href="/login" className="font-semibold text-secondary hover:underline">
            Back to Sign In
          </Link>
        </p>

        <p className="mt-8 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>
      </div>
    </div>
  );
}
