import { serverApi } from "@/lib/http/server-api";
import { ReturnsView } from "@/components/crm/returns-view";

export const dynamic = "force-dynamic";

export default async function SalesReturnPage() {
  const [products, accounts, warehouses, branches, returns] = await Promise.all([
    serverApi.list("product", { pageSize: 500 }).catch(() => ({ items: [] })),
    serverApi.list("account", { pageSize: 500 }).catch(() => ({ items: [] })),
    serverApi.list("warehouse", { pageSize: 200 }).catch(() => ({ items: [] })),
    serverApi.list("branch", { pageSize: 200 }).catch(() => ({ items: [] })),
    serverApi.list("salesReturn", { pageSize: 100, sort: [{ field: "createdAt", dir: "desc" }] }).catch(() => ({ items: [] })),
  ]);
  return (
    <ReturnsView
      products={products.items}
      accounts={accounts.items}
      warehouses={warehouses.items}
      branches={branches.items}
      initialReturns={returns.items}
    />
  );
}
