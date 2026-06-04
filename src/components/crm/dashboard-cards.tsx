import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { serverApi } from "@/lib/http/server-api";
import { getLocale } from "@/lib/i18n/server";
import { t } from "@/lib/i18n/messages";

/**
 * The dashboards previously listed in the sidebar's "Dashboards" group, surfaced
 * on the home Pano as quick-launch cards. Routes are unchanged; cards are filtered
 * to the screens the caller's position may open, so a card never lands on a 403.
 */
const DASHBOARDS: { name: string; href: string; icon: string }[] = [
  { name: "sales-dashboard", href: "/sales-dashboard", icon: "trending" },
  { name: "leads-dashboard", href: "/leads-dashboard", icon: "lead" },
  { name: "deals-dashboard", href: "/deals-dashboard", icon: "target" },
  { name: "project-dashboard", href: "/project-dashboard", icon: "project" },
  { name: "executive-dashboard", href: "/executive-dashboard", icon: "reports" },
  { name: "revenue-dashboard", href: "/revenue-dashboard", icon: "wallet" },
  { name: "growth-dashboard", href: "/growth-dashboard", icon: "trending" },
];

export async function DashboardCards() {
  const [locale, me] = await Promise.all([getLocale(), serverApi.me().catch(() => null)]);
  const allowed = new Set(me?.screens ?? []);
  const items = DASHBOARDS.filter((d) => allowed.has(d.name));
  if (items.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold tracking-tight">{t(locale, "dash.section")}</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((d) => (
          <Link
            key={d.name}
            href={d.href}
            className="group flex items-start gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm transition-all hover:border-border-strong hover:shadow-md"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon name={d.icon} className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-medium text-foreground transition-colors group-hover:text-primary">
                {t(locale, `nav.${d.name}`)}
              </span>
              <span className="mt-0.5 block text-xs text-muted">{t(locale, `dashdesc.${d.name}`)}</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
