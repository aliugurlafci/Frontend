import { metadata } from "@/lib/metadata";
import { serverApi } from "@/lib/http/server-api";
import { PurchaseDocEditor } from "@/components/crm/purchase-doc-editor";

export const dynamic = "force-dynamic";

export default async function PurchaseOrderEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [suppliers, products, warehouses, me] = await Promise.all([
    serverApi.list("supplier", { pageSize: 200 }),
    serverApi.list("product", { pageSize: 500, filters: [{ field: "active", op: "eq", value: true }] }),
    serverApi.list("warehouse", { pageSize: 200 }),
    serverApi.me(),
  ]);

  return (
    <PurchaseDocEditor
      entity={metadata.getEntity("purchaseOrder")}
      apiBase="/purchase-orders"
      id={id}
      mode="po"
      suppliers={suppliers.items}
      products={products.items}
      warehouses={warehouses.items}
      goodsReceipts={[]}
      me={{ userId: me.userId, roles: me.roles }}
    />
  );
}
