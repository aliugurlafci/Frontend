import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { RunJobsButton, WebhookManager } from "@/components/crm/automation-admin";

export const dynamic = "force-dynamic";

export default async function AutomationPage() {
  const ctx = await getServerContext();
  const isAdmin = ctx.roles.includes("admin");

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <h1 className="text-lg font-semibold">Automation</h1>
        <Card>
          <EmptyState icon="settings" title="Administrators only" description="Switch to the Admin persona to manage automation." />
        </Card>
      </div>
    );
  }

  const [jobs, notif] = await Promise.all([serverApi.jobs(), serverApi.notifications()]);
  const recent = notif.items.slice(0, 10);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Automation</h1>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Scheduled jobs" action={<RunJobsButton />} />
          <CardBody className="space-y-2 text-sm">
            <p className="text-xs text-muted">
              Triggered by an external scheduler hitting <code>POST /api/v1/cron/tick</code>, or “Run now”.
            </p>
            {jobs.map((j) => (
              <div key={j.name} className="flex items-center justify-between border-b border-border pb-1.5 last:border-0">
                <div>
                  <div className="font-medium">{j.label}</div>
                  <div className="text-xs text-muted">schedule: {j.schedule}</div>
                </div>
                <div className="text-right text-xs">
                  {j.last ? (
                    <>
                      <Badge tone="success">{j.last.summary}</Badge>
                      <div className="text-muted">{new Date(j.last.at).toLocaleString()}</div>
                    </>
                  ) : (
                    <span className="text-muted-2">never run</span>
                  )}
                </div>
              </div>
            ))}
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Notifications (recent)" />
          <CardBody>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No notifications yet. Send a quote/invoice or win a deal.</p>
            ) : (
              <ul className="space-y-1.5 text-xs">
                {recent.map((n) => (
                  <li key={n.id} className="flex items-center justify-between gap-2">
                    <span>
                      <Badge tone={n.channel === "email" ? "info" : "neutral"}>{n.channel}</Badge> {n.subject}
                    </span>
                    <span className="text-muted">{new Date(n.at).toLocaleTimeString()}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Webhooks" />
          <CardBody>
            <WebhookManager />
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
