import { serverApi } from "@/lib/http/server-api";
import { getLocale } from "@/lib/i18n/server";
import { t as translate } from "@/lib/i18n/messages";
import { entityLabel } from "@/lib/i18n/labels";
import { fmtDate, fmtTime } from "@/lib/i18n/format";
import { metadata } from "@/lib/metadata";
import type { Locale } from "@/lib/i18n/config";
import type { AuditEntry, AuditAction } from "@/lib/domain/audit";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

const ACTION_TONE: Record<AuditAction, "success" | "info" | "danger" | "warning"> = {
  create: "success",
  update: "info",
  delete: "danger",
  transition: "warning",
};
const ACTION_DOT: Record<AuditAction, string> = {
  create: "bg-success",
  update: "bg-info",
  delete: "bg-danger",
  transition: "bg-warning",
};

/** Localized entity label, falling back to the raw entity name. */
function entityLabelOf(name: string, locale: Locale): string {
  try {
    return entityLabel(metadata.getEntity(name), locale);
  } catch {
    return name;
  }
}

export default async function ActivityPage() {
  const locale = await getLocale();
  const tr = (k: string, vars?: Record<string, string>) => translate(locale, k, vars);
  const entries = await serverApi.activity(200);

  // Group by calendar day (locale-formatted).
  const byDay = new Map<string, AuditEntry[]>();
  for (const e of entries) {
    const day = fmtDate(locale, e.at);
    const bucket = byDay.get(day);
    if (bucket) bucket.push(e);
    else byDay.set(day, [e]);
  }

  return (
    <div className="space-y-3">
      <div>
        <h1 className="text-lg font-semibold">{tr("activityPage.title")}</h1>
        <p className="text-xs text-muted">{tr("activityPage.subtitle")}</p>
      </div>

      <Card>
        <CardBody className="space-y-5">
          {[...byDay.entries()].map(([day, items]) => (
            <div key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">{day}</h2>
              <ol className="space-y-3 border-l border-border pl-4">
                {items.map((a) => {
                  const action = (a.action ?? "update") as AuditAction;
                  const actor = a.actorName ?? String(a.actorId);
                  return (
                    <li key={a.id} className="relative text-xs">
                      <span className={`absolute -left-[1.2rem] top-1.5 h-2 w-2 rounded-full ${ACTION_DOT[action]}`} />
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="font-semibold text-foreground">{actor}</span>
                        <Badge tone={ACTION_TONE[action]}>{tr(`activityPage.action.${action}`)}</Badge>
                        <Badge tone="neutral">{entityLabelOf(a.entity, locale)}</Badge>
                        <span className="font-mono text-muted-2">#{a.recordId}</span>
                        {action === "transition" && a.from && a.to && (
                          <span className="inline-flex items-center gap-1 text-muted-2">
                            <Badge tone="neutral">{a.from}</Badge>
                            <span aria-hidden>→</span>
                            <Badge tone="info">{a.to}</Badge>
                          </span>
                        )}
                        <span className="ml-auto shrink-0 tabular-nums text-muted-2">{fmtTime(locale, a.at)}</span>
                      </div>
                      <p className="mt-0.5 text-muted">{a.summary}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          ))}
          {entries.length === 0 && <p className="text-sm text-muted">{tr("dash.noActivity")}</p>}
        </CardBody>
      </Card>
    </div>
  );
}
