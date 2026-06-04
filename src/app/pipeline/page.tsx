import { metadata } from "@/lib/metadata";
import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { permissionEngine } from "@/lib/permissions/engine";
import { EntityView } from "@/components/crm/entity-view";

export const dynamic = "force-dynamic";

const EMPTY = { items: [], total: 0, page: 1, pageSize: 25, pageCount: 1 };

export default async function PipelinePage() {
  const def = metadata.getEntity("deal");
  const ctx = await getServerContext();

  let initial = EMPTY as Awaited<ReturnType<typeof serverApi.list>>;
  try {
    initial = await serverApi.list("deal", { pageSize: 100 });
  } catch {
    // read not permitted for this role — render an empty, read-only view
  }

  const canCreate = permissionEngine.can(ctx, { action: "deal:create", entity: "deal" });
  const canUpdate = permissionEngine.can(ctx, { action: "deal:update", entity: "deal" });
  const canDelete = permissionEngine.can(ctx, { action: "deal:delete", entity: "deal" });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Pipeline</h1>
        <p className="text-xs text-muted">Deals by stage</p>
      </div>
      <EntityView
        entity={def}
        initial={initial}
        canCreate={canCreate}
        canDelete={canDelete}
        canUpdate={canUpdate}
        focusId={undefined}
      />
    </div>
  );
}
