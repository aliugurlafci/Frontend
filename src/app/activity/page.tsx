import { serverApi } from "@/lib/http/server-api";
import { getT } from "@/lib/i18n/server";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function ActivityPage() {
  const entries = await serverApi.activity(100);
  const t = await getT();

  const byDay = new Map<string, typeof entries>();
  for (const e of entries) {
    const day = new Date(e.at).toLocaleDateString();
    (byDay.get(day) ?? byDay.set(day, []).get(day)!).push(e);
  }

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-semibold">{t("activityPage.title")}</h1>
      <Card>
        <CardBody className="space-y-5">
          {[...byDay.entries()].map(([day, items]) => (
            <div key={day}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-2">{day}</h2>
              <ol className="space-y-2 border-l border-border pl-3">
                {items.map((a) => (
                  <li key={a.id} className="relative text-xs">
                    <span className="absolute -left-[1.45rem] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                    <span className="text-foreground">{a.summary}</span>{" "}
                    <Badge tone="neutral">{a.entity}</Badge>
                    <span className="ml-1 text-muted-2">{t("activityPage.by", { actor: String(a.actorId) })}</span>
                    <div className="text-muted">{new Date(a.at).toLocaleTimeString()}</div>
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {entries.length === 0 && <p className="text-sm text-muted">{t("dash.noActivity")}</p>}
        </CardBody>
      </Card>
    </div>
  );
}
