"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function LockScreenPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);

  return (
    <AuthLayout center>
      {/* Avatar */}
      <div className="mb-5 flex flex-col items-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/15 text-lg font-bold text-primary ring-1 ring-primary/20">
          AA
        </div>
        <p className="mt-3 text-base font-semibold text-foreground">Avery Admin</p>
      </div>

      <h1 className="text-center text-2xl font-bold tracking-tight">Locked</h1>
      <p className="mt-1 text-center text-sm text-muted">Enter your password to unlock the panel.</p>

      <form
        className="mt-7 space-y-5 text-left"
        onSubmit={(e) => {
          e.preventDefault();
          router.push("/");
        }}
      >
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

        <button type="submit" className={AUTH_BUTTON}>
          Unlock
        </button>
      </form>
    </AuthLayout>
  );
}
