"use client";

import { useRouter } from "next/navigation";
import { AuthLayout, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function Error500Page() {
  const router = useRouter();

  return (
    <AuthLayout center>
      <p className="text-gradient text-7xl font-black tracking-tight">500</p>
      <h1 className="mt-3 text-2xl font-bold">Server Error</h1>
      <p className="mx-auto mt-3 max-w-md text-sm text-muted">
        Something went wrong on our end. Please try again later or head back home.
      </p>

      <button type="button" onClick={() => router.push("/")} className={`${AUTH_BUTTON} mt-7 w-auto px-6`}>
        Back to Home
      </button>
    </AuthLayout>
  );
}
