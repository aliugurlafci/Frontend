import { serverApi } from "@/lib/http/server-api";
import { getServerContext } from "@/lib/http/server-context";
import { permissionEngine } from "@/lib/permissions/engine";
import { CartView } from "@/components/crm/cart-view";

export const dynamic = "force-dynamic";

export default async function CartPage() {
  const ctx = await getServerContext();
  const can = (verb: string) => permissionEngine.can(ctx, { action: `cart:${verb}`, entity: "cart" });

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
      // Each cart capability is its own grant (Settings → Permissions → Carts),
      // so the sale buttons and the register-queue tab follow what this position
      // actually holds.
      canSend={can("send")}
      canCheckout={can("checkout")}
      canCredit={can("credit")}
      canQueue={can("read")}
      canEditQueued={can("update")}
    />
  );
}
