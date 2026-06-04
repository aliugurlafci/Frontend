"use client";

import { useRouter } from "next/navigation";

export default function Error500Page() {
  const router = useRouter();

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

        <p className="text-7xl font-bold tracking-tight text-primary">500</p>
        <h1 className="mt-3 text-2xl font-bold">Server Error</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Something went wrong on our end. Please try again later or head back home.
        </p>

        <button
          type="button"
          onClick={() => router.push("/")}
          className="mt-7 h-11 rounded-md bg-primary px-6 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover"
        >
          Back to Home
        </button>

        <p className="mt-8 text-center text-xs text-muted">Copyright © 2026 — Aula CRM</p>
      </div>
    </div>
  );
}
