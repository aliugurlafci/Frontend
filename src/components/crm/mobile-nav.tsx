"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { groupNav, hrefOf, type NavItem } from "./sidebar";
import { useI18n } from "@/lib/i18n/context";

/** Off-canvas navigation drawer for mobile (< md). */
export function MobileNav({
  items,
  open,
  onClose,
}: {
  items: NavItem[];
  open: boolean;
  onClose: () => void;
}) {
  const path = usePathname();
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const link = (href: string, active: boolean, icon: string, label: string) => (
    <Link
      href={href}
      onClick={onClose}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
      )}
    >
      <Icon name={icon} className="h-4 w-4" />
      {label}
    </Link>
  );

  return (
    <div className="fixed inset-0 z-50 md:hidden">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <nav
        aria-label="Mobile"
        className="relative flex h-full w-64 flex-col border-r border-border bg-surface"
      >
        <div className="flex h-12 items-center justify-between border-b border-border px-3">
          <span className="text-sm font-semibold">Aula CRM</span>
          <button onClick={onClose} aria-label="Close menu" className="rounded-md p-1 text-muted hover:bg-surface-2">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
          {link("/", path === "/", "home", t("nav.home"))}
          {groupNav(items).map((g) => (
            <div key={g.group} className="space-y-0.5">
              <div className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-2">
                {t(`group.${g.group}`)}
              </div>
              {g.items.map((item) =>
                link(hrefOf(item), path === hrefOf(item), item.icon ?? "target", item.pluralLabel),
              )}
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
}
