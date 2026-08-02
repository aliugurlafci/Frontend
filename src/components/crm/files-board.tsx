"use client";

import { useMemo, useRef, useState, useTransition, type DragEvent } from "react";
import { toast } from "sonner";
import { apiFetch, apiUploadWithProgress, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils/cn";

type Folder = "documents" | "contracts" | "invoices" | "media" | "other";

export interface FileRecord {
  id: string;
  name: string;
  folder: Folder;
  sizeKb: number;
  owner: string;
  createdAt: string;
  version: number;
}

/** One file in the upload queue, with its own progress and outcome. */
interface QueuedFile {
  file: File;
  status: "waiting" | "uploading" | "done" | "error";
  progress: number;
  error?: string;
}

const FOLDERS: Folder[] = ["documents", "contracts", "invoices", "media", "other"];
const FOLDER_ICON: Record<Folder, string> = {
  documents: "file",
  contracts: "shield",
  invoices: "receipt",
  media: "image",
  other: "folder",
};

const STORAGE_CAP_KB = 100 * 1024 * 1024; // 100 GB

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function fmtSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

/**
 * File manager backed by the `file` entity + real local-disk storage.
 *
 * Uploading is the primary action here, so it gets a permanent drop zone rather
 * than a toggle: drop (or pick) any number of files, watch each one's progress,
 * and they land in the folder chosen above. The folder cards double as filters
 * for the list below.
 */
export function FilesBoard({ initial }: { initial: FileRecord[] }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileRecord[]>(initial);
  const [folder, setFolder] = useState<Folder>("documents");
  const [filter, setFilter] = useState<Folder | "all">("all");
  const [queue, setQueue] = useState<QueuedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of files) c[f.folder] = (c[f.folder] ?? 0) + 1;
    return c;
  }, [files]);
  const usedKb = useMemo(() => files.reduce((s, f) => s + (f.sizeKb || 0), 0), [files]);
  const usedPct = Math.min(100, Math.round((usedKb / STORAGE_CAP_KB) * 100));
  const visible = useMemo(() => (filter === "all" ? files : files.filter((f) => f.folder === filter)), [files, filter]);

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
  }

  function enqueue(picked: FileList | File[] | null) {
    const list = Array.from(picked ?? []);
    if (!list.length) return;
    setQueue((prev) => [...prev, ...list.map((file) => ({ file, status: "waiting" as const, progress: 0 }))]);
  }

  function patchQueued(index: number, patch: Partial<QueuedFile>) {
    setQueue((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  }

  /** Upload the queue one file at a time so progress stays readable. */
  async function uploadAll() {
    const pendingItems = queue.map((q, i) => ({ q, i })).filter(({ q }) => q.status === "waiting" || q.status === "error");
    if (!pendingItems.length) {
      toast.error(t("files.chooseFirst"));
      return;
    }
    setBusy(true);
    let uploaded = 0;
    for (const { q, i } of pendingItems) {
      patchQueued(i, { status: "uploading", progress: 0, error: undefined });
      try {
        const form = new FormData();
        form.append("folder", folder);
        form.append("file", q.file);
        const created = await apiUploadWithProgress<FileRecord>("/files/upload", form, (p) =>
          patchQueued(i, { progress: p }),
        );
        setFiles((prev) => [created, ...prev]);
        patchQueued(i, { status: "done", progress: 100 });
        uploaded++;
      } catch (e) {
        patchQueued(i, { status: "error", error: e instanceof ApiRequestError ? e.message : t("common.somethingWrong") });
      }
    }
    setBusy(false);
    if (fileRef.current) fileRef.current.value = "";
    if (uploaded > 0) toast.success(t("files.uploadedCount", { count: String(uploaded) }));
  }

  function onDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragging(false);
    enqueue(e.dataTransfer.files);
  }

  function remove(f: FileRecord) {
    startTransition(async () => {
      try {
        await apiFetch(`/entities/file/${f.id}`, { method: "DELETE", headers: { "if-match": String(f.version) } });
        setFiles((prev) => prev.filter((x) => x.id !== f.id));
      } catch (e) {
        fail(e);
      }
    });
  }

  const waiting = queue.filter((q) => q.status === "waiting" || q.status === "error").length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("files.title")}</h1>
        <p className="text-xs text-muted">{t("files.subtitle")}</p>
      </div>

      {/* ---- upload ---- */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-40">
              <label htmlFor="up-folder" className="mb-1 block text-xs font-medium text-muted">
                {t("files.targetFolder")}
              </label>
              <Select id="up-folder" value={folder} onChange={(e) => setFolder(e.target.value as Folder)} disabled={busy}>
                {FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    {t(`files.folder.${f}`)}
                  </option>
                ))}
              </Select>
            </div>
            <Button variant="primary" size="md" onClick={uploadAll} disabled={busy || waiting === 0}>
              <Icon name="upload" className="h-4 w-4" />
              {busy ? t("files.uploading") : t("files.uploadCount", { count: String(waiting) })}
            </Button>
            {queue.length > 0 && !busy && (
              <Button size="md" onClick={() => setQueue([])}>
                {t("files.clearQueue")}
              </Button>
            )}
          </div>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
            }}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-surface-2/50",
            )}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon name="upload" className="h-6 w-6" />
            </span>
            <p className="text-sm font-semibold">{t("files.dropTitle")}</p>
            <p className="text-xs text-muted">{t("files.dropHint")}</p>
            <input
              ref={fileRef}
              type="file"
              multiple
              className="hidden"
              onChange={(e) => enqueue(e.target.files)}
            />
          </div>

          {queue.length > 0 && (
            <ul className="space-y-1.5">
              {queue.map((q, i) => (
                <li key={`${q.file.name}-${i}`} className="rounded-xl border border-border px-3 py-2">
                  <div className="flex items-center gap-2 text-xs">
                    <Icon
                      name={q.status === "done" ? "checkmark" : q.status === "error" ? "close" : "file"}
                      className={cn(
                        "h-3.5 w-3.5 shrink-0",
                        q.status === "done" && "text-success",
                        q.status === "error" && "text-danger",
                        q.status !== "done" && q.status !== "error" && "text-muted",
                      )}
                    />
                    <span className="min-w-0 flex-1 truncate font-medium">{q.file.name}</span>
                    <span className="shrink-0 tabular-nums text-muted">{fmtSize(q.file.size / 1024)}</span>
                    {q.status === "uploading" && <span className="shrink-0 tabular-nums text-muted">{q.progress}%</span>}
                    {q.status !== "uploading" && !busy && (
                      <button
                        onClick={() => setQueue((prev) => prev.filter((_, idx) => idx !== i))}
                        aria-label={t("files.removeFromQueue")}
                        className="shrink-0 text-muted-2 hover:text-danger"
                      >
                        <Icon name="close" className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  {q.status === "uploading" && (
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded bg-surface-2">
                      <div className="h-1.5 rounded bg-primary transition-all duration-150" style={{ width: `${q.progress}%` }} />
                    </div>
                  )}
                  {q.status === "error" && <p className="mt-1 text-[11px] text-danger">{q.error}</p>}
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      {/* ---- storage ---- */}
      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">{t("files.storage")}</h2>
            <span className="text-xs text-muted">{t("files.storageOf", { used: fmtSize(usedKb) })}</span>
          </div>
          <div className="h-2 rounded bg-surface-2">
            <div className="h-2 rounded bg-primary" style={{ width: `${usedPct}%` }} />
          </div>
        </CardBody>
      </Card>

      {/* ---- folders (also the list filter) ---- */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">{t("files.quickAccess")}</h2>
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <button
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-2xl border px-4 py-3 text-left transition-colors",
              filter === "all" ? "border-primary bg-primary/5" : "border-border hover:bg-surface-2",
            )}
          >
            <p className="text-sm font-medium">{t("common.all")}</p>
            <p className="text-xs text-muted">{t("files.itemsCount", { count: String(files.length) })}</p>
          </button>
          {FOLDERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                filter === f ? "border-primary bg-primary/5" : "border-border hover:bg-surface-2",
              )}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon name={FOLDER_ICON[f]} className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-foreground">{t(`files.folder.${f}`)}</span>
                <span className="block text-xs text-muted">{t("files.itemsCount", { count: String(counts[f] ?? 0) })}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ---- list ---- */}
      <Card className="overflow-hidden">
        <CardHeader
          title={filter === "all" ? t("files.recent") : t(`files.folder.${filter}`)}
          action={<span className="text-xs text-muted">{t("files.itemsCount", { count: String(visible.length) })}</span>}
        />
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">{t("files.colName")}</th>
              <th className="px-4 py-2.5">{t("files.colFolder")}</th>
              <th className="px-4 py-2.5">{t("files.colSize")}</th>
              <th className="px-4 py-2.5">{t("files.colModified")}</th>
              <th className="px-4 py-2.5">{t("files.colOwner")}</th>
              <th className="px-4 py-2.5 text-right">{t("files.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {visible.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">
                  {t("files.empty")}
                </td>
              </tr>
            ) : (
              visible.map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name={FOLDER_ICON[f.folder] ?? "file"} className="h-4 w-4 text-muted" />
                      <a
                        href={`/api/v1/files/${f.id}/download`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {f.name}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted">{t(`files.folder.${f.folder}`)}</td>
                  <td className="px-4 py-3 text-muted">{fmtSize(f.sizeKb)}</td>
                  <td className="px-4 py-3 text-muted">{f.createdAt.slice(0, 10)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                        {initials(f.owner || "?")}
                      </div>
                      <span className="text-foreground">{f.owner || "—"}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button
                      variant="ghost"
                      size="xs"
                      type="button"
                      aria-label={t("files.deleteAria", { name: f.name })}
                      onClick={() => remove(f)}
                      disabled={pending}
                    >
                      <Icon name="trash" className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
