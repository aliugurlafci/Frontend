"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { useI18n } from "@/lib/i18n/context";
import { metadata } from "@/lib/metadata";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";

export function RepublishButton() {
  const router = useRouter();
  const { t } = useI18n();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await apiFetch<{ version: number }>(`/admin/metadata/republish`, { method: "POST" });
      toast.success(t("settings.admin.republished", { version: String(r.version) }));
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" loading={busy} onClick={run}>
      {t("settings.admin.republish")}
    </Button>
  );
}

interface ImportResult {
  created: string[];
  errors: { row: number; message: string }[];
  ignored?: string[];
}

/** Read a file as base64 (without the data: prefix) — for binary .xlsx uploads. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

const XLSX_RE = /\.(xlsx|xls)$/i;

export function ImportForm({ entities }: { entities: { name: string; label: string }[] }) {
  const { t, fieldLabel } = useI18n();
  const [entity, setEntity] = useState(entities[0]?.name ?? "");
  const [payload, setPayload] = useState<{ csv: string } | { xlsx: string } | null>(null);
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setPayload(XLSX_RE.test(file.name) ? { xlsx: await fileToBase64(file) } : { csv: await file.text() });
  }

  async function run() {
    if (!payload) {
      toast.error(t("settings.admin.chooseCsv"));
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      // Send the localized field labels the UI shows as aliases, so a file headed
      // in the user's language (e.g. "Ad", "E-posta") still maps to the fields.
      const def = metadata.findEntity(entity);
      const aliases: Record<string, string> = {};
      for (const f of def?.fields ?? []) {
        if (f.readOnly || f.computed) continue;
        aliases[fieldLabel(f, def?.name)] = f.name;
      }
      const r = await apiFetch<ImportResult>(`/import/${entity}`, { method: "POST", body: { ...payload, aliases } });
      setResult(r);
      if (r.errors.length === 0) {
        toast.success(t("settings.admin.imported", { created: String(r.created.length), errors: String(r.errors.length) }));
      } else {
        toast.error(t("settings.admin.imported", { created: String(r.created.length), errors: String(r.errors.length) }));
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="animate-rise space-y-3">
      <div className="grid gap-2 sm:grid-cols-3 sm:items-end">
        <div>
          <Label htmlFor="imp-entity">{t("settings.admin.entity")}</Label>
          <Select id="imp-entity" value={entity} onChange={(e) => setEntity(e.target.value)} disabled={busy}>
            {entities.map((e) => (
              <option key={e.name} value={e.name}>
                {e.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="imp-file">{t("settings.admin.csvFile")}</Label>
          <Input
            id="imp-file"
            type="file"
            disabled={busy}
            accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            onChange={onFile}
          />
        </div>
        <Button variant="primary" size="sm" loading={busy} onClick={run}>
          {t("settings.admin.import")} {fileName && `(${fileName})`}
        </Button>
      </div>

      <a
        href={`/api/v1/import/${entity}/template?format=xlsx`}
        className="inline-flex w-fit items-center gap-1 text-xs font-medium text-primary hover:underline"
      >
        <Icon name="download" className="h-3.5 w-3.5" /> {t("settings.admin.template")}
      </a>

      {busy && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-muted">
            <Icon name="recurring" className="h-3.5 w-3.5 animate-spin text-primary" />
            {t("settings.admin.importing")} {fileName && `(${fileName})`}
          </div>
          <div className="h-1 w-full animate-pulse rounded-full bg-primary/50" />
        </div>
      )}

      {result && !busy && (
        <div className="animate-rise rounded-xl border border-border bg-surface-2/40 p-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-success/10 px-2 py-0.5 font-medium text-success">
              <Icon name="checkmark" className="h-3 w-3" /> {t("settings.admin.createdRecords", { count: String(result.created.length) })}
            </span>
            {result.errors.length > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 font-medium text-danger">
                <Icon name="close" className="h-3 w-3" /> {t("settings.admin.failedRecords", { count: String(result.errors.length) })}
              </span>
            )}
          </div>
          {result.ignored && result.ignored.length > 0 && (
            <p className="mt-1.5 text-warning">
              {t("settings.admin.ignoredColumns", { cols: result.ignored.join(", ") })}
            </p>
          )}
          {result.errors.length > 0 && (
            <ul className="mt-2 max-h-36 space-y-0.5 overflow-y-auto pr-1 text-danger">
              {result.errors.map((er, i) => (
                <li key={i}>{t("settings.admin.rowError", { row: String(er.row), message: er.message })}</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
