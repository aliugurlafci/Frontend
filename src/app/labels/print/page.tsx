import { LabelPrintView } from "@/components/crm/label-print-view";

export const dynamic = "force-dynamic";

export default async function LabelsPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ productId?: string; templateId?: string }>;
}) {
  const sp = await searchParams;
  return <LabelPrintView initialProductId={sp.productId} initialTemplateId={sp.templateId} />;
}
