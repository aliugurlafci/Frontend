import { serverApi } from "@/lib/http/server-api";
import { NotesBoard, type NoteRecord } from "@/components/crm/notes-board";

export const dynamic = "force-dynamic";

export default async function NotesPage() {
  let initial: NoteRecord[] = [];
  try {
    const res = await serverApi.list("note", { pageSize: 200 });
    initial = res.items.map((r) => ({
      id: r.id,
      title: String(r.title ?? ""),
      body: (r.body as string | null) ?? null,
      updatedAt: r.updatedAt,
      version: r.version,
    }));
  } catch {
    // read not permitted for this role — render an empty board
  }
  return <NotesBoard initial={initial} />;
}
