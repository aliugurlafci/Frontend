"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  return (
    <AuthLayout title="Reset Password" subtitle="Choose a new password for your account.">
      <form
        className="mt-7 space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/login");
        }}
      >
        {/* New Password */}
        <div>
          <label htmlFor="password" className="mb-1.5 block text-sm font-semibold">
            New Password
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

        <button type="submit" className={AUTH_BUTTON}>
          Reset Password
        </button>
      </form>
    </AuthLayout>
  );
}
