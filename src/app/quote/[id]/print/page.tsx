import { metadata } from "@/lib/metadata";
import { serverApi } from "@/lib/http/server-api";
import { DocumentPrint } from "@/components/crm/document-print";

export const dynamic = "force-dynamic";

export default async function QuotePrintPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { doc, lines } = await serverApi.document("quote", id);
  const account = await serverApi.get("account", String(doc.accountId)).catch(() => null);

  return (
    <DocumentPrint
      entity={metadata.getEntity("quote")}
      doc={doc}
      lines={lines}
      accountName={account ? String(account.name) : ""}
    />
  );
}
