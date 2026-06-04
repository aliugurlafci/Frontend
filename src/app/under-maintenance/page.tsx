"use client";

import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";

export default function UnderMaintenancePage() {
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

        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
          <Wrench className="h-7 w-7 text-primary" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight">Under Maintenance</h1>
        <p className="mx-auto mt-3 max-w-md text-sm text-muted">
          Our site is currently down for scheduled maintenance. We&apos;ll be back
          online shortly. Thank you for your patience.
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
