import { serverApi } from "@/lib/http/server-api";
import { PosReceipt } from "@/components/crm/pos-receipt";

export const dynamic = "force-dynamic";

export default async function PosReceiptPage({ params }: { params: Promise<{ invoiceId: string }> }) {
  const { invoiceId } = await params;
  const { doc, lines } = await serverApi.document("invoice", invoiceId);
  return <PosReceipt doc={doc} lines={lines} />;
}
