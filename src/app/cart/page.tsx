import { serverApi } from "@/lib/http/server-api";
import { CartView } from "@/components/crm/cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const [products, accounts, warehouses, branches] = await Promise.all([
    serverApi.list("product", { pageSize: 500 }).catch(() => ({ items: [] })),
    serverApi.list("account", { pageSize: 500 }).catch(() => ({ items: [] })),
    serverApi.list("warehouse", { pageSize: 200 }).catch(() => ({ items: [] })),
    serverApi.list("branch", { pageSize: 200 }).catch(() => ({ items: [] })),
  ]);
  return (
    <CartView
      products={products.items}
      accounts={accounts.items}
      warehouses={warehouses.items}
      branches={branches.items}
    />
  );
}
