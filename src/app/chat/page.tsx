import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { ChatBoard, type MessageRecord } from "@/components/crm/chat-board";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const ctx = await getServerContext();
  let initial: MessageRecord[] = [];
  try {
    const res = await serverApi.list("chatMessage", { pageSize: 500 });
    initial = res.items.map((r) => ({
      id: r.id,
      peer: String(r.peer ?? ""),
      author: (r.author as string | null) ?? null,
      body: String(r.body ?? ""),
      fromMe: Boolean(r.fromMe),
      createdAt: r.createdAt,
      version: r.version,
    }));
  } catch {
    // read not permitted for this role — render an empty board
  }
  return <ChatBoard initial={initial} me={ctx.displayName} />;
}
