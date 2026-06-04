import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import type { EntityRecord } from "@/lib/metadata/types";

export const dynamic = "force-dynamic";

const usd = (n: number) => "$" + Math.round(n).toLocaleString();

export default async function ProjectDashboardPage() {
  const projectEntity = metadata.getEntity("project");
  const nameField = projectEntity.fields.find((f) => f.name === "name")!;
  const statusField = projectEntity.fields.find((f) => f.name === "status")!;
  const dueField = projectEntity.fields.find((f) => f.name === "dueDate")!;
  const milestoneEntity = metadata.getEntity("milestone");
  const mStatusField = milestoneEntity.fields.find((f) => f.name === "status")!;

  let projects: EntityRecord[] = [];
  try {
    const res = await serverApi.list("project", { pageSize: 500, sort: [{ field: "dueDate", dir: "asc" }] });
    projects = res.items;
  } catch {
    projects = [];
  }

  let milestones: EntityRecord[] = [];
  try {
    const res = await serverApi.list("milestone", { pageSize: 500 });
    milestones = res.items;
  } catch {
    milestones = [];
  }

  const active = projects.filter((p) => p.status === "active").length;
  const totalBudget = projects.reduce(
    (sum, p) => sum + (typeof p.budget === "number" ? p.budget : 0),
    0,
  );
  const avgProgress =
    projects.length > 0
      ? Math.round(
          projects.reduce((sum, p) => sum + (typeof p.progress === "number" ? p.progress : 0), 0) /
            projects.length,
        )
      : 0;

  const milestoneByStatus = (mStatusField.options ?? []).map((o) => ({
    label: o.label,
    count: milestones.filter((m) => m.status === o.value).length,
  }));

  const stats = [
    { label: "Total Projects", value: String(projects.length) },
    { label: "Active", value: String(active) },
    { label: "Avg Progress", value: `${avgProgress}%` },
    { label: "Total Budget", value: usd(totalBudget) },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Project Dashboard</h1>
        <p className="text-xs text-muted">Delivery status across active engagements.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label}>
            <CardBody>
              <p className="text-xs font-medium uppercase tracking-wide text-muted">{s.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{s.value}</p>
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Projects" />
          <Table>
            <THead>
              <tr>
                <TH>Project</TH>
                <TH>Status</TH>
                <TH>Progress</TH>
                <TH>Due Date</TH>
              </tr>
            </THead>
            <tbody>
              {projects.slice(0, 8).map((p) => {
                const progress = typeof p.progress === "number" ? p.progress : 0;
                return (
                  <TR key={p.id}>
                    <TD>
                      <ValueCell field={nameField} value={p.name ?? null} />
                    </TD>
                    <TD>
                      <ValueCell field={statusField} value={p.status ?? null} />
                    </TD>
                    <TD>
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 rounded bg-surface-2">
                          <div className="h-1.5 rounded bg-primary" style={{ width: `${progress}%` }} />
                        </div>
                        <span className="tabular-nums text-xs text-muted">{progress}%</span>
                      </div>
                    </TD>
                    <TD>
                      <ValueCell field={dueField} value={p.dueDate ?? null} />
                    </TD>
                  </TR>
                );
              })}
              {projects.length === 0 && (
                <TR>
                  <TD>No projects.</TD>
                </TR>
              )}
            </tbody>
          </Table>
        </Card>

        <Card>
          <CardHeader title="Milestones by status" />
          <CardBody>
            <ul className="space-y-2">
              {milestoneByStatus.map((m) => (
                <li key={m.label} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{m.label}</span>
                  <span className="tabular-nums text-muted">{m.count}</span>
                </li>
              ))}
              {milestones.length === 0 && <li className="text-xs text-muted">No milestones.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}
