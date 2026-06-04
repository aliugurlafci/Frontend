"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const CODE_LENGTH = 4;

export default function EmailVerificationPage() {
  const router = useRouter();
  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(""));
  const inputs = useRef<Array<HTMLInputElement | null>>([]);

  function handleChange(index: number, value: string) {
    const char = value.replace(/[^0-9a-zA-Z]/g, "").slice(-1);
    setCode((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < CODE_LENGTH - 1) {
      inputs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  }

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

        <h1 className="text-2xl font-bold">Email Verification</h1>
        <p className="mt-1 text-sm text-muted">
          We sent a 4-digit code to your email.
        </p>

        <form
          className="mt-7 space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            router.push("/");
          }}
        >
          <div className="flex justify-center gap-3">
            {code.map((value, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={value}
                onChange={(e) => handleChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                aria-label={`Digit ${index + 1}`}
                className="h-12 w-12 rounded-md border border-border bg-surface text-center text-lg font-semibold text-foreground focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
              />
            ))}
          </div>

          <button
            type="submit"
            className="h-11 w-full rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Verify
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted">
          Didn&apos;t get the code?{" "}
          <button type="button" className="font-semibold text-secondary hover:underline">
            Resend code
          </button>
        </p>

        <p className="mt-8 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>
      </div>
    </div>
  );
}
