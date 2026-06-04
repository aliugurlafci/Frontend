import { serverApi } from "@/lib/http/server-api";
import { UsersAdmin, type UserRecord, type PositionOption } from "@/components/crm/users-admin";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  try {
    const [usersRaw, posPage] = await Promise.all([serverApi.adminUsers(), serverApi.list("position", { pageSize: 100 })]);
    const positions: PositionOption[] = posPage.items.map((p) => ({ id: p.id, name: String(p.name ?? "") }));
    const users: UserRecord[] = usersRaw.map((u) => ({
      id: String(u.id),
      email: String(u.email ?? ""),
      displayName: String(u.displayName ?? ""),
      positionId: String(u.positionId ?? ""),
      active: u.active !== false,
    }));
    return <UsersAdmin initial={users} positions={positions} />;
  } catch {
    return (
      <Card>
        <CardBody>
          <EmptyState icon="shield" title="Administrators only" description="You need an admin position to manage users." />
        </CardBody>
      </Card>
    );
  }
}
