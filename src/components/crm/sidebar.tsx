"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";

export interface NavItem {
  name: string;
  pluralLabel: string;
  icon?: string;
  group?: string;
  /** Explicit href (for non-entity screens); defaults to `/${name}`. */
  href?: string;
}

const GROUP_ORDER = [
  "dashboards",
  "crm",
  "sales",
  "projects",
  "marketing",
  "support",
  "people",
  "finance",
  "comms",
  "admin",
];
const GROUP_LABEL: Record<string, string> = {
  dashboards: "Dashboards",
  crm: "CRM",
  sales: "Sales",
  projects: "Projects",
  marketing: "Marketing",
  support: "Support",
  people: "People",
  finance: "Finance",
  comms: "Communication",
  admin: "Admin",
};

export function groupNav(items: NavItem[]): { group: string; label: string; items: NavItem[] }[] {
  const by = new Map<string, NavItem[]>();
  for (const it of items) {
    const g = it.group ?? "crm";
    const bucket = by.get(g) ?? [];
    bucket.push(it);
    by.set(g, bucket);
  }
  return GROUP_ORDER.filter((g) => by.has(g)).map((g) => ({
    group: g,
    label: GROUP_LABEL[g] ?? g,
    items: by.get(g)!,
  }));
}

export function hrefOf(it: NavItem): string {
  return it.href ?? `/${it.name}`;
}

function NavLink({
  href,
  active,
  icon,
  label,
  collapsed,
  onClick,
}: {
  href: string;
  active: boolean;
  icon: string;
  label: string;
  collapsed?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      title={collapsed ? label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors",
        active ? "bg-primary/10 text-primary" : "text-muted hover:bg-surface-2 hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon name={icon} className="h-4 w-4 shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </Link>
  );
}

/** Desktop sidebar (hidden on mobile — see MobileNav). Collapsible to icons. */
export function Sidebar({
  items,
  collapsed,
  onToggle,
}: {
  items: NavItem[];
  collapsed: boolean;
  onToggle: () => void;
}) {
  const path = usePathname();
  const { t } = useI18n();
  const groups = groupNav(items);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        "hidden shrink-0 flex-col border-r border-border bg-surface transition-[width] md:flex",
        collapsed ? "w-16" : "w-56",
      )}
    >
      <div className="flex h-12 items-center gap-2 border-b border-border px-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary text-xs font-bold text-primary-foreground shadow-sm">
          A
        </div>
        {!collapsed && <span className="text-sm font-semibold tracking-tight">Aula CRM</span>}
      </div>
      <div className="flex-1 space-y-0.5 overflow-y-auto p-2">
        <NavLink href="/" active={path === "/"} icon="home" label={t("nav.home")} collapsed={collapsed} />
        {groups.map((g) => (
          <div key={g.group} className="space-y-0.5">
            {!collapsed && (
              <div className="px-2.5 pb-1 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-2">
                {t(`group.${g.group}`)}
              </div>
            )}
            {g.items.map((item) => (
              <NavLink
                key={item.name}
                href={hrefOf(item)}
                active={path === hrefOf(item)}
                icon={item.icon ?? "target"}
                label={item.pluralLabel}
                collapsed={collapsed}
              />
            ))}
          </div>
        ))}
      </div>
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="m-2 flex h-8 items-center justify-center rounded-md text-muted hover:bg-surface-2"
      >
        <Icon name={collapsed ? "chevronRight" : "chevronLeft"} />
      </button>
    </nav>
  );
}
