import { metadata } from "@/lib/metadata";
import { serverApi } from "@/lib/http/server-api";
import { PurchaseDocEditor } from "@/components/crm/purchase-doc-editor";

export const dynamic = "force-dynamic";

export default async function VendorBillEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [suppliers, products, goodsReceipts] = await Promise.all([
    serverApi.list("supplier", { pageSize: 200 }),
    serverApi.list("product", { pageSize: 500, filters: [{ field: "active", op: "eq", value: true }] }),
    serverApi.list("goodsReceipt", { pageSize: 200, sort: [{ field: "number", dir: "desc" }] }),
  ]);

  return (
    <PurchaseDocEditor
      entity={metadata.getEntity("vendorBill")}
      apiBase="/vendor-bills"
      id={id}
      mode="bill"
      suppliers={suppliers.items}
      products={products.items}
      warehouses={[]}
      goodsReceipts={goodsReceipts.items}
    />
  );
}
