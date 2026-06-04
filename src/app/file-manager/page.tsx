import { serverApi } from "@/lib/http/server-api";
import { FilesBoard, type FileRecord } from "@/components/crm/files-board";

export const dynamic = "force-dynamic";

type Folder = "documents" | "contracts" | "invoices" | "media" | "other";

export default async function FileManagerPage() {
  let initial: FileRecord[] = [];
  try {
    const res = await serverApi.list("file", { pageSize: 500 });
    initial = res.items.map((r) => ({
      id: r.id,
      name: String(r.name ?? ""),
      folder: ((r.folder as Folder) ?? "other"),
      sizeKb: typeof r.sizeKb === "number" ? r.sizeKb : 0,
      owner: String(r.owner ?? ""),
      createdAt: r.createdAt,
      version: r.version,
    }));
  } catch {
    // read not permitted for this role — render an empty board
  }
  return <FilesBoard initial={initial} />;
}
