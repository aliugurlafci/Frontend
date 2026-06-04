import { notFound } from "next/navigation";
import { metadata } from "@/lib/metadata";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { permissionEngine } from "@/lib/permissions/engine";
import { EntityView } from "@/components/crm/entity-view";

export const dynamic = "force-dynamic";

const EMPTY = { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 };

export default async function EntityPage({
  params,
  searchParams,
}: {
  params: Promise<{ entity: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { entity } = await params;
  const def = metadata.findEntity(entity);
  if (!def) notFound();

  const ctx = await getServerContext();

  let initial = EMPTY as Awaited<ReturnType<typeof serverApi.list>>;
  try {
    initial = await serverApi.list(entity, { pageSize: 25 });
  } catch {
    // read not permitted for this role — render an empty, read-only view
  }

  const canCreate = permissionEngine.can(ctx, { action: `${entity}:create`, entity });
  const canUpdate = permissionEngine.can(ctx, { action: `${entity}:update`, entity });
  const canDelete = permissionEngine.can(ctx, { action: `${entity}:delete`, entity });

  const focus = (await searchParams).focus;
  const focusId = typeof focus === "string" ? focus : undefined;

  return (
    <EntityView
      entity={def}
      initial={initial}
      canCreate={canCreate}
      canDelete={canDelete}
      canUpdate={canUpdate}
      focusId={focusId}
    />
  );
}
