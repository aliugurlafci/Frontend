import Link from "next/link";
import { getServerContext } from "@/lib/http/server-context";
import { metadata } from "@/lib/metadata";
import { FEATURE_FLAGS } from "@/lib/config/feature-flags";
import { serverApi } from "@/lib/http/server-api";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ImportForm, RepublishButton } from "@/components/crm/settings-admin";
import { ExportMenu } from "@/components/crm/export-menu";

export const dynamic = "force-dynamic";

const SECTIONS: { href: string; title: string; description: string }[] = [
  { href: "/settings/profile", title: "Profile", description: "Your name, email, phone and timezone." },
  { href: "/settings/security", title: "Security", description: "Password, two-factor and active sessions." },
  { href: "/settings/notifications", title: "Notifications", description: "Choose which events reach you and how." },
  { href: "/settings/appearance", title: "Appearance", description: "Theme, accent color and density." },
  { href: "/settings/roles", title: "Roles & Permissions", description: "Review what each role can access." },
  { href: "/settings/users", title: "Manage Users", description: "Invite teammates and manage access." },
];

export default async function SettingsPage() {
  const ctx = await getServerContext();
  const isAdmin = ctx.roles.includes("admin");
  const entities = metadata.listEntities();
  const importable = entities.filter((e) => !e.system).map((e) => ({ name: e.name, label: e.label }));
  const releases = isAdmin ? await serverApi.releases().catch(() => []) : [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Settings</h1>
        <p className="text-xs text-muted">Manage your account and workspace</p>
      </div>

      {/* Settings sections */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SECTIONS.map((s) => (
          <Card key={s.href}>
            <CardHeader title={s.title} />
            <CardBody className="space-y-3 text-sm">
              <p className="text-muted">{s.description}</p>
              <Link href={s.href} className="inline-flex text-xs font-medium text-primary hover:underline">
                Open →
              </Link>
            </CardBody>
          </Card>
        ))}
      </div>

      {/* Account summary */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Account" />
          <CardBody className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted">Name</span>
              <span>{ctx.displayName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Email</span>
              <span>{ctx.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Roles</span>
              <span className="flex gap-1">
                {ctx.roles.map((r) => (
                  <Badge key={r} tone="info">
                    {r}
                  </Badge>
                ))}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted">Tenant</span>
              <span>{ctx.tenantId}</span>
            </div>
            <p className="pt-2 text-xs text-muted">Theme is controlled from the top bar.</p>
          </CardBody>
        </Card>

        {/* Feature flags */}
        <Card>
          <CardHeader title="Feature flags" />
          <CardBody className="space-y-1.5 text-sm">
            {Object.entries(FEATURE_FLAGS).map(([flag, on]) => (
              <div key={flag} className="flex items-center justify-between">
                <span>{flag}</span>
                <Badge tone={on ? "success" : "neutral"}>{on ? "on" : "off"}</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      {/* Metadata */}
      <Card>
        <CardHeader title="Metadata" action={isAdmin ? <RepublishButton /> : undefined} />
        <CardBody className="text-sm">
          <p className="mb-2 text-xs text-muted">
            Published version <strong>v{metadata.version}</strong> · {entities.length} entities
          </p>
          <ul className="grid grid-cols-2 gap-1">
            {entities.map((e) => (
              <li key={e.name} className="flex justify-between rounded bg-surface-2 px-2 py-1">
                <span>{e.pluralLabel}</span>
                <span className="text-muted">{e.fields.length} fields</span>
              </li>
            ))}
          </ul>
        </CardBody>
      </Card>

      {/* Import / Export */}
      <Card>
        <CardHeader title="Import / Export" />
        <CardBody className="space-y-4">
          <ImportForm entities={importable} />
          <div>
            <div className="mb-1 text-xs font-semibold uppercase text-muted">Export (Excel · PDF · CSV)</div>
            <div className="flex flex-wrap gap-2">
              {importable.map((e) => (
                <ExportMenu key={e.name} entity={e.name} label={e.label} />
              ))}
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Release / audit trail */}
      <Card>
        <CardHeader title="Release & audit trail" />
        <CardBody>
          {releases.length === 0 ? (
            <p className="text-sm text-muted">No governed releases recorded yet.</p>
          ) : (
            <ol className="space-y-1.5 text-xs">
              {releases.map((r) => (
                <li key={r.id} className="flex items-center justify-between">
                  <span>
                    <Badge tone="info">{r.kind}</Badge> {r.note ?? ""}
                  </span>
                  <span className="text-muted">
                    {r.actor} · {new Date(r.at).toLocaleString()}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
