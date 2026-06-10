"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";

function Avatar({ src, initials, label, size = "h-8 w-8" }: { src?: string; initials: string; label: string; size?: string }) {
  return (
    <span className={cn("flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-[11px] font-semibold text-primary-foreground", size)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={label} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </span>
  );
}

/** Topbar account chip → dropdown (profile, settings, sign out). The profile +
 *  settings entries live under the gated `/settings/*` screen, so they only show
 *  when the signed-in position has been granted the Settings screen. */
export function HeaderUserMenu({ displayName, avatarUrl, canSettings }: { displayName: string; avatarUrl?: string; canSettings: boolean }) {
  const router = useRouter();
  const { t } = useI18n();
  const [, startTransition] = useTransition();

  const initials = displayName.split(/\s+/).map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "U";

  function go(href: string, close: () => void) {
    router.push(href);
    close();
  }
  function logout(close: () => void) {
    close();
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
    <DropdownMenu
      align="end"
      panelClassName="w-56"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label={displayName}
          className="flex items-center gap-2 rounded-full border border-border-strong bg-surface/40 py-1 pl-1 pr-1.5 backdrop-blur-sm transition-all hover:bg-surface-2 active:scale-[0.98] sm:pr-2.5"
        >
          <Avatar src={avatarUrl} initials={initials} label={displayName} />
          <span className="hidden max-w-[8rem] truncate text-sm font-medium text-foreground lg:block">{displayName}</span>
          <Icon name="chevronDown" className={cn("hidden h-3.5 w-3.5 text-muted transition-transform duration-200 sm:block", open && "rotate-180")} />
        </button>
      )}
    >
      {({ close }) => (
        <>
          <div className="flex items-center gap-2.5 border-b border-border px-2.5 py-2.5">
            <Avatar src={avatarUrl} initials={initials} label={displayName} size="h-9 w-9" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-foreground">{displayName}</span>
              <span className="block text-xs text-muted">{t("header.account")}</span>
            </span>
          </div>
          <div className="p-1">
            {canSettings && (
              <>
                <MenuItem onClick={() => go("/settings/profile", close)}>
                  <Icon name="user" className="h-4 w-4 text-muted" /> {t("header.profile")}
                </MenuItem>
                <MenuItem onClick={() => go("/settings", close)}>
                  <Icon name="settings" className="h-4 w-4 text-muted" /> {t("nav.settings")}
                </MenuItem>
                <div className="my-1 h-px bg-border" />
              </>
            )}
            <MenuItem danger onClick={() => logout(close)}>
              <Icon name="logout" className="h-4 w-4" /> {t("common.signOut")}
            </MenuItem>
          </div>
        </>
      )}
    </DropdownMenu>
  );
}
