"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { apiFetch, apiUploadWithProgress, ApiRequestError } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

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

const FOLDERS: Folder[] = ["documents", "contracts", "invoices", "media", "other"];

const STORAGE_CAP_KB = 100 * 1024 * 1024; // 100 GB

function initials(name: string): string {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("") || "?";
}
function fmtSize(kb: number): string {
  if (kb >= 1024 * 1024) return `${(kb / 1024 / 1024).toFixed(1)} GB`;
  if (kb >= 1024) return `${(kb / 1024).toFixed(1)} MB`;
  return `${Math.round(kb)} KB`;
}

/** File manager backed by the `file` entity + real local-disk storage. */
export function FilesBoard({ initial }: { initial: FileRecord[] }) {
  const { t } = useI18n();
  const [files, setFiles] = useState<FileRecord[]>(initial);
  const [uploading, setUploading] = useState(false);
  const [folder, setFolder] = useState<Folder>("documents");
  const [pending, startTransition] = useTransition();
  // Upload progress: null when idle, 0..100 (then "saving") while in flight.
  const [progress, setProgress] = useState<number | null>(null);
  const [uploadName, setUploadName] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const f of files) c[f.folder] = (c[f.folder] ?? 0) + 1;
    return c;
  }, [files]);
  const usedKb = useMemo(() => files.reduce((s, f) => s + (f.sizeKb || 0), 0), [files]);
  const usedPct = Math.min(100, Math.round((usedKb / STORAGE_CAP_KB) * 100));

  function fail(e: unknown) {
    toast.error(e instanceof ApiRequestError ? e.message : t("common.somethingWrong"));
  }

  async function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error(t("files.chooseFirst"));
      return;
    }
    const form = new FormData();
    form.append("folder", folder);
    form.append("file", file);
    setUploadName(file.name);
    setProgress(0);
    try {
      const created = await apiUploadWithProgress<FileRecord>("/files/upload", form, setProgress);
      setFiles((prev) => [created, ...prev]);
      if (fileRef.current) fileRef.current.value = "";
      setFolder("documents");
      setUploading(false);
      toast.success(t("files.uploaded", { name: created.name }));
    } catch (e) {
      fail(e);
    } finally {
      setProgress(null);
      setUploadName("");
    }
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold">{t("files.title")}</h1>
        <p className="text-xs text-muted">{t("files.subtitle")}</p>
      </div>

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

      <div>
        <h2 className="mb-2 text-sm font-semibold">{t("files.quickAccess")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {FOLDERS.map((f) => (
            <Card key={f} className="transition-colors hover:bg-surface-2">
              <CardBody className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon name="file" className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{t(`files.folder.${f}`)}</p>
                  <p className="text-xs text-muted">{t("files.itemsCount", { count: String(counts[f] ?? 0) })}</p>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      </div>

      <Card className="overflow-hidden">
        <CardHeader
          title={t("files.recent")}
          action={
            <Button variant="primary" size="sm" onClick={() => setUploading((v) => !v)} disabled={pending || progress !== null}>
              <Icon name="plus" className="h-3.5 w-3.5" />
              {t("files.upload")}
            </Button>
          }
        />
        {uploading && (
          <div className="space-y-2 border-b border-border p-3">
            <form
              className="flex flex-wrap items-center gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                upload();
              }}
            >
              <Select
                value={folder}
                onChange={(e) => setFolder(e.target.value as Folder)}
                className="w-36"
                disabled={progress !== null}
              >
                {FOLDERS.map((f) => (
                  <option key={f} value={f}>
                    {t(`files.folder.${f}`)}
                  </option>
                ))}
              </Select>
              <input
                ref={fileRef}
                type="file"
                disabled={progress !== null}
                className="flex-1 text-sm text-muted file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-primary-foreground disabled:opacity-60"
              />
              <Button type="submit" variant="primary" size="sm" disabled={progress !== null}>
                {progress !== null ? t("files.uploading") : t("files.upload")}
              </Button>
            </form>
            {progress !== null && (
              <div className="space-y-1">
                <div className="flex items-center justify-between text-xs text-muted">
                  <span className="truncate">
                    {progress < 100
                      ? t("files.uploadingName", { name: uploadName })
                      : t("files.processingName", { name: uploadName })}
                  </span>
                  <span className="tabular-nums">{progress}%</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded bg-surface-2">
                  <div className="h-1.5 rounded bg-primary transition-all duration-150" style={{ width: `${progress}%` }} />
                </div>
              </div>
            )}
          </div>
        )}
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium uppercase tracking-wide text-muted-2">
              <th className="px-4 py-2.5">{t("files.colName")}</th>
              <th className="px-4 py-2.5">{t("files.colSize")}</th>
              <th className="px-4 py-2.5">{t("files.colModified")}</th>
              <th className="px-4 py-2.5">{t("files.colOwner")}</th>
              <th className="px-4 py-2.5 text-right">{t("files.colActions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {files.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted">
                  {t("files.empty")}
                </td>
              </tr>
            ) : (
              files.map((f) => (
                <tr key={f.id} className="transition-colors hover:bg-surface-2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Icon name="file" className="h-4 w-4 text-muted" />
                      <a
                        href={`/api/v1/files/${f.id}/download`}
                        className="font-medium text-foreground hover:text-primary hover:underline"
                      >
                        {f.name}
                      </a>
                    </div>
                  </td>
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
                    <Button variant="ghost" size="xs" type="button" aria-label={t("files.deleteAria", { name: f.name })} onClick={() => remove(f)} disabled={pending}>
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
