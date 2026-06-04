import { getServerContext } from "@/lib/http/server-context";
import { serverApi } from "@/lib/http/server-api";
import { FeedBoard, type PostRecord } from "@/components/crm/feed-board";

export const dynamic = "force-dynamic";

export default async function SocialFeedPage() {
  const ctx = await getServerContext();
  let initial: PostRecord[] = [];
  try {
    const res = await serverApi.list("post", { pageSize: 200 });
    initial = res.items.map((r) => ({
      id: r.id,
      author: String(r.author ?? ""),
      body: String(r.body ?? ""),
      likes: typeof r.likes === "number" ? r.likes : 0,
      liked: Boolean(r.liked),
      comments: typeof r.comments === "number" ? r.comments : 0,
      shares: typeof r.shares === "number" ? r.shares : 0,
      createdAt: r.createdAt,
      version: r.version,
    }));
  } catch {
    // read not permitted for this role — render an empty feed
  }
  return <FeedBoard initial={initial} me={ctx.displayName} />;
}
