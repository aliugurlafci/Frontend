"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

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

        <h1 className="text-2xl font-bold">Create an Account</h1>
        <p className="mt-1 text-sm text-muted">
          Join the Aula CRM platform in just a few steps.
        </p>

        <form
          className="mt-7 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/login");
          }}
        >
          {/* Name */}
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-semibold">
              Name
            </label>
            <input
              id="name"
              type="text"
              placeholder="Avery Admin"
              className="h-11 w-full rounded-md border border-border bg-surface px-3 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
          </div>

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

          {/* Password */}
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
              Password
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
              >
                {showPassword ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirm"
                type={showConfirm ? "text" : "password"}
                placeholder="••••••••"
                className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((s) => !s)}
                aria-label={showConfirm ? "Hide password" : "Show password"}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-2 hover:text-foreground"
              >
                {showConfirm ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Terms */}
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 rounded border-border accent-primary"
            />
            I agree to the terms and conditions
          </label>

          <button
            type="submit"
            className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Sign Up
          </button>
        </form>

        <p className="mt-5 text-sm text-muted">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-secondary hover:underline">
            Sign In
          </Link>
        </p>

        {/* Divider */}
        <div className="my-6 flex items-center gap-3 text-xs font-medium text-muted-2">
          <span className="h-px flex-1 bg-border" />
          OR
          <span className="h-px flex-1 bg-border" />
        </div>

        {/* Social buttons */}
        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            className="flex h-11 items-center justify-center rounded-md bg-[#1877f2] text-white transition-opacity hover:opacity-90"
            aria-label="Continue with Facebook"
          >
            <span className="text-lg font-bold">f</span>
          </button>
          <button
            type="button"
            className="flex h-11 items-center justify-center rounded-md border border-border bg-surface transition-colors hover:bg-surface-2"
            aria-label="Continue with Google"
          >
            <span className="text-lg font-bold text-[#ea4335]">G</span>
          </button>
          <button
            type="button"
            className="flex h-11 items-center justify-center rounded-md bg-black text-white transition-opacity hover:opacity-90"
            aria-label="Continue with Apple"
          >
            <span className="text-lg"></span>
          </button>
        </div>

        <p className="mt-8 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>
      </div>
    </div>
  );
}
