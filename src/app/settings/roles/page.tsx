import { serverApi } from "@/lib/http/server-api";
import { PositionsAdmin, type PositionRecord } from "@/components/crm/positions-admin";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

function parseScreens(v: unknown): string[] {
  try {
    const p = JSON.parse(String(v ?? "[]"));
    return Array.isArray(p) ? p.map(String) : [];
  } catch {
    return [];
  }
}

export default async function PositionsPage() {
  try {
    const [page, screens] = await Promise.all([serverApi.list("position", { pageSize: 100 }), serverApi.screens()]);
    const positions: PositionRecord[] = page.items.map((p) => ({
      id: p.id,
      name: String(p.name ?? ""),
      role: String(p.role ?? "sales_rep"),
      description: (p.description as string | null) ?? null,
      screens: parseScreens(p.screens),
      version: p.version,
    }));
    return <PositionsAdmin initial={positions} screens={screens} />;
  } catch {
    return (
      <Card>
        <CardBody>
          <EmptyState icon="shield" title="Administrators only" description="You need an admin position to manage positions & screen access." />
        </CardBody>
      </Card>
    );
  }
}
