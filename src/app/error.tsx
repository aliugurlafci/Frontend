"use client";

import { AlertTriangle } from "lucide-react";
import { useT } from "@/lib/i18n/client";
import { Button } from "@/components/ui/button";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  // Cookie-based translator (no provider) — resilient inside an error boundary.
  const t = useT();
  return (
    <div className="mx-auto max-w-md py-16">
      <div className="glass glass-sheen rounded-2xl p-8 text-center shadow-[var(--shadow-glass)] animate-rise">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger/10 text-danger ring-1 ring-danger/20">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="text-lg font-semibold">{t("auth.boundary.title")}</h2>
        <p className="mt-2 text-sm text-muted">{error.message}</p>
        <Button variant="primary" className="mt-5" onClick={reset}>
          {t("auth.boundary.retry")}
        </Button>
      </div>
    </div>
  );
}
