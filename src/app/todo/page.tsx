import { serverApi } from "@/lib/http/server-api";
import { TodoBoard, type TodoRecord } from "@/components/crm/todo-board";

export const dynamic = "force-dynamic";

type Priority = "high" | "medium" | "low";

export default async function TodoPage() {
  let initial: TodoRecord[] = [];
  try {
    const res = await serverApi.list("todo", { pageSize: 200 });
    initial = res.items.map((r) => ({
      id: r.id,
      title: String(r.title ?? ""),
      priority: ((r.priority as Priority) ?? "medium"),
      dueDate: (r.dueDate as string | null) ?? null,
      done: Boolean(r.done),
      version: r.version,
    }));
  } catch {
    // read not permitted for this role — render an empty board
  }
  return <TodoBoard initial={initial} />;
}
