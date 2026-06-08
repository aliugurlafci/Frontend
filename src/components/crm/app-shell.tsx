import type { ReactNode } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { metadata } from "@/lib/metadata";
import { screenKeyForPath, screenCatalog } from "@/lib/config/screens";
import { serverApi } from "@/lib/http/server-api";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { t } from "@/lib/i18n/messages";
import { ShellClient } from "./shell-client";
import { AccessDenied } from "./access-denied";
import type { NavItem } from "./sidebar";

/** Auth/status screens render without the app chrome (and without auth checks). */
const PUBLIC_PREFIXES = [
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
  "/email-verification",
  "/two-step-verification",
  "/lock-screen",
  "/coming-soon",
  "/under-maintenance",
  "/error-500",
];
const isPublic = (p: string) => PUBLIC_PREFIXES.some((x) => p === x || p.startsWith(`${x}/`));

/** Non-entity screens added to the grouped nav (key === screen key === route). */
const NAV_EXTRAS: NavItem[] = [
  // Note: the dashboard screens (sales/leads/deals/project/executive/revenue/growth)
  // are no longer listed here — they surface as cards on the home Pano
  // (see DashboardCards). Their routes + screen-access are unchanged.
  { name: "pos", pluralLabel: "Point of Sale", icon: "pos", group: "sales", href: "/pos" },
  { name: "stock-levels", pluralLabel: "Stock Levels", icon: "stock", group: "inventory", href: "/stock-levels" },
  { name: "label-designer", pluralLabel: "Label Designer", icon: "label", group: "inventory", href: "/label-designer" },
  { name: "labels", pluralLabel: "Label Printing", icon: "printer", group: "inventory", href: "/labels/print" },
  { name: "calendar", pluralLabel: "Calendar", icon: "calendar", group: "crm", href: "/calendar" },
  { name: "activity", pluralLabel: "Activity", icon: "activity", group: "crm", href: "/activity" },
  { name: "pipeline", pluralLabel: "Pipeline", icon: "pipeline", group: "sales", href: "/pipeline" },
  { name: "email", pluralLabel: "Email", icon: "email", group: "comms", href: "/email" },
  { name: "chat", pluralLabel: "Chat", icon: "chat", group: "comms", href: "/chat" },
  { name: "calls", pluralLabel: "Calls", icon: "call", group: "comms", href: "/calls" },
  { name: "file-manager", pluralLabel: "Files", icon: "file", group: "comms", href: "/file-manager" },
  { name: "todo", pluralLabel: "To Do", icon: "todo", group: "comms", href: "/todo" },
  { name: "notes", pluralLabel: "Notes", icon: "note", group: "comms", href: "/notes" },
  { name: "reports", pluralLabel: "Reports", icon: "reports", group: "finance", href: "/reports" },
  { name: "finance", pluralLabel: "Finance", icon: "finance", group: "finance", href: "/finance" },
  { name: "automation", pluralLabel: "Automation", icon: "recurring", group: "admin", href: "/automation" },
  { name: "settings", pluralLabel: "Settings", icon: "settings", group: "admin", href: "/settings" },
];

export async function AppShell({ children }: { children: ReactNode }) {
  const pathname = (await headers()).get("x-pathname") ?? "";

  // Auth/status screens render bare (and skip the auth/screen checks).
  if (isPublic(pathname)) return <>{children}</>;

  // Resolve the signed-in user + their allowed screens; bounce to login if not.
  let me;
  try {
    me = await serverApi.me();
  } catch {
    redirect("/login");
  }

  const collapsed = (await cookies()).get("aula_sidebar")?.value === "1";
  const locale = await getLocale();
  // Admins always see every screen (current + any newly added), independent of
  // the screens stored on their position — so new features surface without a
  // re-seed. Non-admins are gated by their position's granted screens.
  // "home" (the dashboard) is always reachable so users land somewhere.
  const isAdmin = me.roles?.includes("admin");
  const allowed = isAdmin
    ? new Set<string>([...screenCatalog(metadata).map((s) => s.key), "home"])
    : new Set<string>([...me.screens, "home"]);

  // `task` is intentionally kept out of the nav: the generic Tasks screen overlaps
  // with To Do, so it's hidden here. The entity itself stays registered so the
  // calendar and automation triggers that depend on it keep working.
  const entityItems: NavItem[] = metadata
    .listEntities()
    .filter((e) => !e.system && e.name !== "task" && allowed.has(e.name))
    .map((e) => ({ name: e.name, pluralLabel: entityLabel(e, locale, { plural: true }), icon: e.icon, group: e.group ?? "crm" }));

  const items = [
    ...entityItems,
    ...NAV_EXTRAS.filter((x) => allowed.has(x.name)).map((x) => ({ ...x, pluralLabel: t(locale, `nav.${x.name}`) })),
  ];

  const currentScreen = screenKeyForPath(pathname);
  const denied = !allowed.has(currentScreen);

  return (
    <ShellClient items={items} displayName={me.displayName} initialCollapsed={collapsed}>
      {denied ? <AccessDenied screen={currentScreen} /> : children}
    </ShellClient>
  );
}
