"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useT } from "@/lib/i18n/client";

/** Phase F6 — triggers the recurring billing run. */
export function RunRecurringButton() {
  const router = useRouter();
  const t = useT();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await apiFetch<{ count: number }>(`/recurring/run`, { method: "POST" });
      toast.success(res.count ? t("recurring.generated", { count: String(res.count) }) : t("recurring.noneDue"));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button size="sm" loading={busy} onClick={run}>
      <Icon name="recurring" className="h-3.5 w-3.5" /> {t("recurring.run")}
    </Button>
  );
}
