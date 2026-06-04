import { metadata } from "@/lib/metadata";
import { serverApi } from "@/lib/http/server-api";
import { DocumentEditor } from "@/components/crm/document-editor";

export const dynamic = "force-dynamic";

export default async function QuoteEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accounts, products] = await Promise.all([
    serverApi.list("account", { pageSize: 200 }),
    serverApi.list("product", { pageSize: 200, filters: [{ field: "active", op: "eq", value: true }] }),
  ]);

  return (
    <DocumentEditor
      entity={metadata.getEntity("quote")}
      apiBase="/quotes"
      id={id}
      accounts={accounts.items}
      products={products.items}
      dateFields={[{ name: "validUntil", label: "Valid Until" }]}
      convert={{ label: "Convert to invoice" }}
    />
  );
}
