import { Suspense } from "react";
import { serverApi } from "@/lib/http/server-api";
import { MailBoard, type EmailRecord } from "@/components/crm/mail-board";

export const dynamic = "force-dynamic";

type FolderId = "inbox" | "sent" | "drafts" | "spam" | "trash";

const SAFETY_PAGES = 500; // backstop (~100k messages) so a pathological mailbox can't loop forever

function toEmail(r: Record<string, unknown>): EmailRecord {
  return {
    id: String(r.id),
    folder: (r.folder as FolderId) ?? "inbox",
    // These MUST be mapped here too — the server-rendered initial state is what a
    // page refresh shows, and without them a moved/starred message renders in its
    // base folder until something triggers a client reload.
    folderId: r.folderId ? String(r.folderId) : null,
    starred: Boolean(r.starred),
    messageId: r.messageId ? String(r.messageId) : "",
    sender: String(r.sender ?? ""),
    subject: String(r.subject ?? ""),
    body: String(r.preview ?? ""), // preview in the list; full text fetched lazily on open
    bodyFull: false,
    unread: Boolean(r.unread),
    createdAt: String(r.createdAt ?? ""),
    version: Number(r.version ?? 0),
  };
}

export default async function EmailPage() {
  let initial: EmailRecord[] = [];
  try {
    const all: EmailRecord[] = [];
    for (let page = 1; page <= SAFETY_PAGES; page++) {
      const res = await serverApi.emailList(page);
      all.push(...res.items.map(toEmail));
      if (res.items.length < 200) break; // last page
    }
    initial = all;
  } catch {
    // read not permitted for this role — render an empty mailbox
  }
  return (
    <Suspense fallback={null}>
      <MailBoard initial={initial} />
    </Suspense>
  );
}
