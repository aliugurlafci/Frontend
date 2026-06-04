"use client";

import { useState } from "react";
import { Mail } from "lucide-react";

export default function ComingSoonPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-lg text-center">
        {/* Brand */}
        <div className="mb-8 flex items-center justify-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-xl font-bold text-primary-foreground">
            A
          </div>
          <span className="text-2xl font-bold tracking-tight">Aula CRM</span>
        </div>

        <h1 className="text-4xl font-bold tracking-tight">Coming Soon</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          We are working hard to bring you something great. Leave your email and
          we&apos;ll let you know the moment we launch.
        </p>

        <form
          className="mt-7 flex flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            setSubmitted(true);
          }}
        >
          <div className="relative flex-1">
            <input
              type="email"
              placeholder="you@example.com"
              className="h-11 w-full rounded-md border border-border bg-surface px-3 pr-10 text-sm text-foreground placeholder:text-muted-2 focus:outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
            />
            <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
          </div>
          <button
            type="submit"
            className="h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
          >
            Notify Me
          </button>
        </form>

        {submitted && (
          <p className="mt-4 text-sm text-secondary">
            Thanks! We&apos;ll keep you posted.
          </p>
        )}

        <p className="mt-8 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>
      </div>
    </div>
  );
}
