"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Icon } from "@/components/ui/icon";
import { useI18n } from "@/lib/i18n/context";

/** Signed-in user chip + sign-out (clears the session cookie via the backend). */
export function LogoutButton({ displayName }: { displayName: string }) {
  const router = useRouter();
  const { t } = useI18n();
  const [pending, startTransition] = useTransition();

  function logout() {
    startTransition(async () => {
      try {
        await apiFetch("/auth/logout", { method: "POST" });
      } catch {
        /* clear client state regardless */
      }
      router.push("/login");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden text-xs text-muted lg:inline">{displayName}</span>
      <button
        onClick={logout}
        disabled={pending}
        aria-label={t("common.signOut")}
        title={t("common.signOut")}
        className="flex items-center gap-1 rounded-lg border border-border-strong bg-surface/40 px-2 py-1.5 text-xs text-muted backdrop-blur-sm transition-colors hover:bg-surface-2 hover:text-foreground disabled:opacity-60"
      >
        <Icon name="logout" className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">{t("common.signOut")}</span>
      </button>
    </div>
  );
}
