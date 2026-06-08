import { serverApi } from "@/lib/http/server-api";
import { GoodsReceiptEditor } from "@/components/crm/goods-receipt-editor";

export const dynamic = "force-dynamic";

export default async function GoodsReceiptEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [suppliers, products, warehouses, purchaseOrders] = await Promise.all([
    serverApi.list("supplier", { pageSize: 200 }),
    serverApi.list("product", { pageSize: 500, filters: [{ field: "active", op: "eq", value: true }] }),
    serverApi.list("warehouse", { pageSize: 200 }),
    serverApi.list("purchaseOrder", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
  ]);

  return (
    <GoodsReceiptEditor
      id={id}
      suppliers={suppliers.items}
      products={products.items}
      warehouses={warehouses.items}
      purchaseOrders={purchaseOrders.items}
    />
  );
}
