import { serverApi } from "@/lib/http/server-api";
import { CallsBoard, type CallRecord } from "@/components/crm/calls-board";

export const dynamic = "force-dynamic";

type CallType = "incoming" | "outgoing" | "missed";

export default async function CallsPage() {
  let initial: CallRecord[] = [];
  try {
    const res = await serverApi.list("call", { pageSize: 200 });
    initial = res.items.map((r) => ({
      id: r.id,
      contact: String(r.contact ?? ""),
      type: ((r.type as CallType) ?? "outgoing"),
      durationSec: typeof r.durationSec === "number" ? r.durationSec : 0,
      createdAt: r.createdAt,
      version: r.version,
    }));
  } catch {
    // read not permitted for this role — render an empty board
  }
  return <CallsBoard initial={initial} />;
}
