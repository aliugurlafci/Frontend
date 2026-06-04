"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input, Label, Select } from "@/components/ui/input";

export function RepublishButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await apiFetch<{ version: number }>(`/admin/metadata/republish`, { method: "POST" });
      toast.success(`Metadata re-published (v${r.version})`);
      router.refresh();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <Button size="sm" loading={busy} onClick={run}>
      Re-publish metadata
    </Button>
  );
}

interface ImportResult {
  created: string[];
  errors: { row: number; message: string }[];
}

export function ImportForm({ entities }: { entities: { name: string; label: string }[] }) {
  const [entity, setEntity] = useState(entities[0]?.name ?? "");
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setCsv(await file.text());
  }

  async function run() {
    if (!csv) {
      toast.error("Choose a CSV file first");
      return;
    }
    setBusy(true);
    setResult(null);
    try {
      const r = await apiFetch<ImportResult>(`/import/${entity}`, { method: "POST", body: { csv } });
      setResult(r);
      toast.success(`Imported ${r.created.length} · ${r.errors.length} errors`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-3 sm:items-end">
        <div>
          <Label htmlFor="imp-entity">Entity</Label>
          <Select id="imp-entity" value={entity} onChange={(e) => setEntity(e.target.value)}>
            {entities.map((e) => (
              <option key={e.name} value={e.name}>
                {e.label}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label htmlFor="imp-file">CSV file</Label>
          <Input id="imp-file" type="file" accept=".csv,text/csv" onChange={onFile} />
        </div>
        <Button variant="primary" size="sm" loading={busy} onClick={run}>
          Import {fileName && `(${fileName})`}
        </Button>
      </div>
      {result && (
        <div className="text-xs">
          <p className="text-success">Created {result.created.length} records.</p>
          {result.errors.length > 0 && (
            <ul className="mt-1 space-y-0.5 text-danger">
              {result.errors.slice(0, 8).map((er, i) => (
                <li key={i}>
                  Row {er.row}: {er.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
