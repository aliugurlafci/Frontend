"use client";

import { useEffect, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { cn } from "@/lib/utils/cn";
import { Sidebar, type NavItem } from "./sidebar";
import { MobileNav } from "./mobile-nav";
import { CommandPalette } from "./command-palette";
import { HeaderUserMenu } from "./header-user-menu";
import { LanguageSwitcher } from "./language-switcher";
import { NotificationsBell } from "./notifications-bell";
import { AutoMailSync } from "./auto-mail-sync";
import { useI18n } from "@/lib/i18n/context";

/** Resolve a human page title for the current route from the nav items. */
function resolveTitle(pathname: string, items: NavItem[], t: (k: string) => string): string {
  if (pathname === "/") return t("header.dashboard");
  const seg = pathname.split("/").filter(Boolean)[0] ?? "";
  if (seg === "settings") return t("nav.settings");
  const item = items.find((i) => i.name === seg || i.href === `/${seg}`);
  if (item) return item.pluralLabel;
  return seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : "";
}

export function ShellClient({
  items,
  displayName,
  avatarUrl,
  initialCollapsed,
  canSettings,
  children,
}: {
  items: NavItem[];
  displayName: string;
  avatarUrl?: string;
  initialCollapsed: boolean;
  canSettings: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { t } = useI18n();
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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

  // Deepen the header's shadow once the page scrolls (modern scroll-aware chrome).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const title = resolveTitle(pathname, items, t);

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
        <header
          className={cn(
            "glass-strong animate-header-down sticky top-0 z-30 flex h-16 items-center gap-3 border-b px-4 transition-shadow duration-300 sm:gap-4 sm:px-6",
            scrolled ? "border-border shadow-[var(--shadow-md)]" : "border-border/60",
          )}
        >
          <button
            className="rounded-lg p-2 text-muted transition-all hover:bg-surface-2 hover:text-foreground active:scale-95 md:hidden"
            aria-label={t("header.menu")}
            onClick={() => setMobileOpen(true)}
          >
            <Icon name="menu" className="h-5 w-5" />
          </button>

          <h1 className="hidden shrink-0 truncate text-base font-semibold text-foreground sm:block">{title}</h1>

          {/* Search sits in a flexible, centred lane so the header stays balanced. */}
          <div className="flex min-w-0 flex-1 justify-center">
            <button
              onClick={() => setCmdOpen(true)}
              className="group flex h-9 w-full min-w-0 max-w-md items-center gap-2 rounded-xl border border-border-strong bg-surface/40 px-3 text-sm text-muted-2 backdrop-blur-sm transition-all hover:border-primary/40 hover:bg-surface hover:text-muted"
            >
              <Icon name="search" className="h-4 w-4 shrink-0 transition-colors group-hover:text-primary" />
              <span className="hidden truncate sm:inline">{t("common.search")}</span>
              <kbd className="ml-auto hidden rounded border border-border-strong px-1.5 py-0.5 text-[10px] sm:inline">⌘K</kbd>
            </button>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-3">
            {/* No backdrop-filter here: a blurred wrapper traps the dropdown panels
                inside its stacking context (they'd render hidden under the header). */}
            <div className="flex items-center gap-1 rounded-full border border-border/60 bg-surface/30 p-1">
              <NotificationsBell />
              <div className="hidden sm:block">
                <LanguageSwitcher />
              </div>
              <ThemeToggle />
            </div>
            <HeaderUserMenu displayName={displayName} avatarUrl={avatarUrl} canSettings={canSettings} />
          </div>
        </header>
        <main id="main-content" className="flex-1 p-4 animate-fade sm:p-6">
          {children}
        </main>
      </div>
    </div>
  );
}
