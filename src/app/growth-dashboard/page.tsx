import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Table, TD, TH, THead, TR } from "@/components/ui/table";
import { ValueCell } from "@/components/crm/value-cell";
import type { EntityRecord } from "@/lib/metadata/types";
import type { AggregateRow } from "@/lib/data/query";

export const dynamic = "force-dynamic";

export default async function GrowthDashboardPage() {
  const campaignEntity = metadata.getEntity("campaign");
  const nameField = campaignEntity.fields.find((f) => f.name === "name")!;
  const channelField = campaignEntity.fields.find((f) => f.name === "channel")!;
  const statusField = campaignEntity.fields.find((f) => f.name === "status")!;
  const sentField = campaignEntity.fields.find((f) => f.name === "sent")!;

  let accountsTotal = 0;
  let leadsTotal = 0;
  let campaigns: EntityRecord[] = [];
  try {
    const res = await serverApi.list("account", { pageSize: 1 });
    accountsTotal = res.total;
  } catch {
    accountsTotal = 0;
  }
  try {
    const res = await serverApi.list("lead", { pageSize: 1 });
    leadsTotal = res.total;
  } catch {
    leadsTotal = 0;
  }
  try {
    const res = await serverApi.list("campaign", { pageSize: 500, sort: [{ field: "sent", dir: "desc" }] });
    campaigns = res.items;
  } catch {
    campaigns = [];
  }

  const running = campaigns.filter((c) => c.status === "running").length;
  const reach = campaigns.reduce(
    (sum, c) => sum + (typeof c.sent === "number" ? c.sent : 0),
    0,
  );

  let byChannel: AggregateRow[] = [];
  try {
    byChannel = await serverApi.aggregate("campaign", {
      groupBy: "channel",
      measures: [{ op: "count", as: "count" }, { op: "sum", field: "sent", as: "sent" }],
    });
  } catch {
    byChannel = [];
  }

  const channelLabel = (key: string | null) =>
    (channelField.options ?? []).find((o) => o.value === key)?.label ?? String(key ?? "—");

  const stats = [
    { label: "Accounts", value: String(accountsTotal) },
    { label: "Leads", value: String(leadsTotal) },
    { label: "Campaigns Running", value: String(running) },
    { label: "Total Reach", value: reach.toLocaleString() },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Growth Dashboard</h1>
        <p className="text-xs text-muted">Acquisition and marketing reach.</p>
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
          <CardHeader title="Campaigns by channel" />
          <CardBody>
            <ul className="space-y-2">
              {byChannel.map((r) => (
                <li key={String(r.key)} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{channelLabel(r.key)}</span>
                  <span className="tabular-nums text-muted">
                    {r.measures.count ?? 0} · {(r.measures.sent ?? 0).toLocaleString()} sent
                  </span>
                </li>
              ))}
              {byChannel.length === 0 && <li className="text-xs text-muted">No data.</li>}
            </ul>
          </CardBody>
        </Card>

        <Card>
          <CardHeader title="Campaigns" />
          <Table>
            <THead>
              <tr>
                <TH>Campaign</TH>
                <TH>Channel</TH>
                <TH>Status</TH>
                <TH>Sent</TH>
              </tr>
            </THead>
            <tbody>
              {campaigns.slice(0, 8).map((c) => (
                <TR key={c.id}>
                  <TD>
                    <ValueCell field={nameField} value={c.name ?? null} />
                  </TD>
                  <TD>
                    <ValueCell field={channelField} value={c.channel ?? null} />
                  </TD>
                  <TD>
                    <ValueCell field={statusField} value={c.status ?? null} />
                  </TD>
                  <TD>
                    <ValueCell field={sentField} value={c.sent ?? null} />
                  </TD>
                </TR>
              ))}
              {campaigns.length === 0 && (
                <TR>
                  <TD>No campaigns.</TD>
                </TR>
              )}
            </tbody>
          </Table>
        </Card>
      </div>
    </div>
  );
}
