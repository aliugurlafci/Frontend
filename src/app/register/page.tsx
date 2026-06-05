"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, EyeOff, Mail } from "lucide-react";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function RegisterPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <AuthLayout title="Create an Account" subtitle="Join the Aula CRM platform in just a few steps.">
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
          <input id="name" type="text" placeholder="Avery Admin" className={AUTH_FIELD} />
        </div>

        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">
            Email Address
          </label>
          <div className="relative">
            <input id="email" type="email" placeholder="you@example.com" className={`${AUTH_FIELD} pr-10`} />
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
              className={`${AUTH_FIELD} pr-10`}
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
              className={`${AUTH_FIELD} pr-10`}
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
          <input type="checkbox" defaultChecked className="h-4 w-4 rounded border-border accent-primary" />
          I agree to the terms and conditions
        </label>

        <button type="submit" className={AUTH_BUTTON}>
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
          className="flex h-11 items-center justify-center rounded-xl bg-[#1877f2] text-white shadow-sm transition-all hover:brightness-110"
          aria-label="Continue with Facebook"
        >
          <span className="text-lg font-bold">f</span>
        </button>
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-xl border border-border-strong bg-surface/60 backdrop-blur-sm transition-colors hover:bg-surface-2"
          aria-label="Continue with Google"
        >
          <span className="text-lg font-bold text-[#ea4335]">G</span>
        </button>
        <button
          type="button"
          className="flex h-11 items-center justify-center rounded-xl bg-black text-white shadow-sm transition-all hover:brightness-125"
          aria-label="Continue with Apple"
        >
          <span className="text-lg"></span>
        </button>
      </div>
    </AuthLayout>
  );
}
