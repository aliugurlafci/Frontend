import { serverApi } from "@/lib/http/server-api";
import { getServerContext } from "@/lib/http/server-context";
import { settingsAccess } from "@/lib/permissions/settings-access";
import { getT } from "@/lib/i18n/server";
import { UsersAdmin, type UserRecord, type PositionOption } from "@/components/crm/users-admin";
import { SettingsDenied } from "@/components/crm/settings-denied";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export const dynamic = "force-dynamic";

export default async function UsersPage() {
  const ctx = await getServerContext();
  const access = settingsAccess(ctx);
  if (!access.can("settings.users", "read")) return <SettingsDenied area="settings.users" />;

  try {
    const [usersRaw, posPage] = await Promise.all([serverApi.adminUsers(), serverApi.list("position", { pageSize: 100 })]);
    const positions: PositionOption[] = posPage.items.map((p) => ({ id: p.id, name: String(p.name ?? "") }));
    const users: UserRecord[] = usersRaw.map((u) => ({
      id: String(u.id),
      email: String(u.email ?? ""),
      displayName: String(u.displayName ?? ""),
      positionId: String(u.positionId ?? ""),
      managerId: u.managerId ? String(u.managerId) : "",
      phone: (u.phone as string | null) ?? "",
      jobTitle: (u.jobTitle as string | null) ?? "",
      active: u.active !== false,
      twoFactorEnabled: Boolean(u.twoFactorEnabled),
    }));
    return (
      <UsersAdmin
        initial={users}
        positions={positions}
        caps={{
          create: access.can("settings.users", "create"),
          update: access.can("settings.users", "update"),
          password: access.can("settings.users", "password"),
          twoFactor: access.can("settings.users", "twoFactor"),
          activate: access.can("settings.users", "activate"),
        }}
      />
    );
  } catch {
    const t = await getT();
    return (
      <Card>
        <CardBody>
          <EmptyState icon="shield" title={t("settings.users.adminsOnly")} description={t("settings.users.adminsOnlyDesc")} />
        </CardBody>
      </Card>
    );
  }
}
