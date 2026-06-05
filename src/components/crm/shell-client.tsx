"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Sidebar, type NavItem } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { LogoutButton } from "./logout-button";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationsBell } from "./notifications-bell";
import { AutoMailSync } from "./auto-mail-sync";
import { useI18n } from "@/lib/i18n/context";

export function ShellClient({
  items,
  displayName,
  initialCollapsed,
  children,
}: {
  items: NavItem[];
  displayName: string;
  initialCollapsed: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  // Global Cmd/Ctrl+K opens the command palette.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      document.cookie = `aula_sidebar=${next ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
      return next;
    });
  }

  // Auth + standalone screens render full-bleed, without the app chrome.
  const CHROMELESS = [
    "/login",
    "/register",
    "/forgot-password",
    "/reset-password",
    "/lock-screen",
    "/email-verification",
    "/two-step-verification",
    "/coming-soon",
    "/under-maintenance",
  ];
  if (CHROMELESS.includes(pathname)) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <AutoMailSync />
      <Sidebar items={items} collapsed={collapsed} onToggle={toggleCollapsed} />
      <MobileNav items={items} open={mobileOpen} onClose={() => setMobileOpen(false)} />
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} entities={items} />

      <div className="flex min-w-0 flex-1 flex-col ">
        <header className="glass sticky top-0 flex items-center gap-2 border-b border-border px-3 py-2.5 sm:px-4">
          <button
            className="rounded-lg p-1.5 text-muted transition-colors hover:bg-surface-2 md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <button
            onClick={() => setCmdOpen(true)}
            className="flex h-9 min-w-0 max-w-sm flex-1 items-center gap-2 rounded-lg border border-border-strong bg-surface/50 px-3 text-sm text-muted-2 backdrop-blur-sm transition-colors hover:bg-surface hover:text-muted"
          >
            <Icon name="search" className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{t("common.search")}</span>
            <kbd className="ml-auto hidden rounded border border-border-strong px-1.5 py-0.5 text-[10px] sm:inline">
              ⌘K
            </kbd>
          </button>

          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-1.5">
            <NotificationsBell />
            <LanguageSwitcher />
            <ThemeToggle />
            <LogoutButton displayName={displayName} />
          </div>
        </header>
        <main id="main-content" className="flex-1 p-4 animate-fade sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
