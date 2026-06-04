"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

export interface PostRecord {
  id: string;
  author: string;
  body: string;
  likes: number;
  liked: boolean;
  comments: number;
  shares: number;
  createdAt: string;
  version: number;
}

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}

/** Social feed backed by the `post` entity (persists to the backend/DB). */
export function FeedBoard({ initial, me }: { initial: PostRecord[]; me: string }) {
  const [posts, setPosts] = useState<PostRecord[]>(initial);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : "Something went wrong");
  }

  function publish() {
    const body = draft.trim();
    if (!body) return;
    startTransition(async () => {
      try {
        const created = await apiFetch<PostRecord>("/entities/post", {
          method: "POST",
          body: { author: me, body, likes: 0, liked: false, comments: 0, shares: 0 },
        });
        setPosts((prev) => [created, ...prev]);
        setDraft("");
      } catch (e) {
        fail(e);
      }
    });
  }

  function deletePost(p: PostRecord) {
    startTransition(async () => {
      try {
        await apiFetch(`/entities/post/${p.id}`, { method: "DELETE", headers: { "if-match": String(p.version) } });
        setPosts((prev) => prev.filter((x) => x.id !== p.id));
      } catch (e) {
        fail(e);
      }
    });
  }

  function toggleLike(p: PostRecord) {
    startTransition(async () => {
      try {
        const updated = await apiFetch<PostRecord>(`/entities/post/${p.id}`, {
          method: "PATCH",
          body: { liked: !p.liked, likes: p.liked ? Math.max(0, p.likes - 1) : p.likes + 1 },
          headers: { "if-match": String(p.version) },
        });
        setPosts((prev) => prev.map((x) => (x.id === p.id ? updated : x)));
      } catch (e) {
        fail(e);
      }
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">Social Feed</h1>
        <p className="text-xs text-muted">Stay connected with your network</p>
      </div>

      <div className="mx-auto w-full max-w-2xl space-y-4">
        <Card>
          <CardBody className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {initials(me)}
              </div>
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="What's on your mind?"
                className="min-h-16"
              />
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={publish} disabled={pending}>
                <Icon name="social" className="h-3.5 w-3.5" />
                Post
              </Button>
            </div>
          </CardBody>
        </Card>

        {posts.length === 0 && <p className="text-center text-sm text-muted">No posts yet. Share something.</p>}

        {posts.map((p) => (
          <Card key={p.id}>
            <CardBody className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {initials(p.author)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.author}</p>
                  <p className="text-xs text-muted-2">{p.createdAt.slice(0, 10)}</p>
                </div>
                <button
                  type="button"
                  aria-label={`Delete post by ${p.author}`}
                  onClick={() => deletePost(p)}
                  disabled={pending}
                  className="ml-auto rounded p-1 text-muted-2 transition-colors hover:bg-surface-2 hover:text-danger"
                >
                  <Icon name="trash" className="h-4 w-4" />
                </button>
              </div>

              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">{p.body}</p>

              <div className="flex items-center gap-6 border-t border-border pt-3 text-xs text-muted">
                <button
                  type="button"
                  onClick={() => toggleLike(p)}
                  disabled={pending}
                  className={cn(
                    "flex items-center gap-1.5 transition-colors hover:text-primary",
                    p.liked && "font-medium text-primary",
                  )}
                >
                  <Icon name="check" className="h-4 w-4" />
                  {p.likes} Likes
                </button>
                <span className="flex items-center gap-1.5">
                  <Icon name="chat" className="h-4 w-4" />
                  {p.comments} Comments
                </span>
                <span className="flex items-center gap-1.5">
                  <Icon name="social" className="h-4 w-4" />
                  {p.shares} Shares
                </span>
              </div>
            </CardBody>
          </Card>
        ))}
      </div>
    </div>
  );
}
