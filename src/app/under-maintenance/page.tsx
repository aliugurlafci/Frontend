"use client";

import { useRouter } from "next/navigation";
import { Wrench } from "lucide-react";
import { AuthLayout, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function UnderMaintenancePage() {
  const router = useRouter();

  return (
    <AuthLayout center>
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/20 to-secondary/15 ring-1 ring-primary/20">
        <Wrench className="h-7 w-7 text-primary" />
      </div>

      <h1 className="text-3xl font-bold tracking-tight">Under Maintenance</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        Our site is currently down for scheduled maintenance. We&apos;ll be back online shortly. Thank you for your
        patience.
      </p>

      <button type="button" onClick={() => router.push("/")} className={`${AUTH_BUTTON} mt-7 w-auto px-6`}>
        Back to Home
      </button>
    </AuthLayout>
  );
}
