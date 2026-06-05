import { getServerContext } from "@/lib/http/server-context";
import { ChatBoard } from "@/components/crm/chat-board";

export const dynamic = "force-dynamic";

export default async function ChatPage() {
  const ctx = await getServerContext();
  const isAdmin = Array.isArray(ctx.roles) && ctx.roles.includes("admin");
  // Conversations/messages load client-side from the privacy-scoped /chat/* API.
  return <ChatBoard meId={String(ctx.userId)} meName={ctx.displayName} isAdmin={isAdmin} />;
}
