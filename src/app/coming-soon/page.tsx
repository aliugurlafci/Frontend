"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { AuthLayout, AUTH_FIELD, AUTH_BUTTON } from "@/components/ui/auth-layout";

export default function ComingSoonPage() {
  const [submitted, setSubmitted] = useState(false);

  return (
    <AuthLayout
      center
      title="Coming Soon"
      subtitle="We are working hard to bring you something great. Leave your email and we'll let you know the moment we launch."
    >
      <form
        className="mt-7 flex flex-col gap-3 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          setSubmitted(true);
        }}
      >
        <div className="relative flex-1">
          <input type="email" placeholder="you@example.com" className={`${AUTH_FIELD} pr-10`} />
          <Mail className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-2" />
        </div>
        <button type="submit" className={`${AUTH_BUTTON} sm:w-auto sm:px-6`}>
          Notify Me
        </button>
      </form>

      {submitted && <p className="mt-4 text-sm text-secondary">Thanks! We&apos;ll keep you posted.</p>}
    </AuthLayout>
  );
}
