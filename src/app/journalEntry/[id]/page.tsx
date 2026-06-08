import { serverApi } from "@/lib/http/server-api";
import { JournalEntryEditor } from "@/components/crm/journal-entry-editor";

export const dynamic = "force-dynamic";

export default async function JournalEntryEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [accounts, branches] = await Promise.all([
    serverApi.list("ledgerAccount", { pageSize: 500, filters: [{ field: "isPostable", op: "eq", value: true }] }),
    serverApi.list("branch", { pageSize: 200 }),
  ]);

  return <JournalEntryEditor id={id} accounts={accounts.items} branches={branches.items} />;
}
