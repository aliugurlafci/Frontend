"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import type { EntityDef, EntityRecord, FieldDef } from "@/lib/metadata/types";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { Tabs } from "@/components/ui/tabs";
import { Icon } from "@/components/ui/icon";
import { ValueCell } from "./value-cell";
import { FieldInput } from "./field-input";
import { useFieldLookups } from "./field-lookups";
import { useI18n } from "@/lib/i18n/context";

interface TransitionOption {
  action: string;
  to: string;
}
interface AuditEntry {
  id: string;
  at: string;
  action: string;
  summary: string;
}
interface RelatedGroup {
  entity: string;
  label: string;
  items: { id: string; title: string }[];
}

export function RecordDrawer({
  entity,
  recordId,
  canDelete,
  canUpdate,
  onClose,
  onChanged,
}: {
  entity: EntityDef;
  recordId: string | null;
  canDelete: boolean;
  canUpdate: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [record, setRecord] = useState<EntityRecord | null>(null);
  const [actions, setActions] = useState<TransitionOption[]>([]);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [related, setRelated] = useState<RelatedGroup[] | null>(null);
  const [tab, setTab] = useState("details");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const lookups = useFieldLookups(entity);
  const { t, locale, entityLabel, fieldLabel } = useI18n();
  const entityName = entityLabel(entity);
  const tabs = [
    { value: "details", label: t("drawer.details") },
    { value: "activity", label: t("drawer.activity") },
    { value: "related", label: t("drawer.related") },
  ];

  async function loadDetail(id: string) {
    const [rec, tr, au] = await Promise.all([
      apiFetch<EntityRecord>(`/entities/${entity.name}/${id}`),
      apiFetch<{ actions: TransitionOption[] }>(`/entities/${entity.name}/${id}/transitions`),
      apiFetch<{ entries: AuditEntry[] }>(`/entities/${entity.name}/${id}/audit`),
    ]);
    setRecord(rec);
    setActions(tr.actions);
    setAudit(au.entries);
  }

  // The parent remounts this component per record (key=recordId), so state
  // starts fresh; this effect only fetches the selected record's detail.
  useEffect(() => {
    if (!recordId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadDetail(recordId).catch((e) => toast.error((e as Error).message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  // Lazily load related records when the tab is first opened.
  useEffect(() => {
    if (tab !== "related" || related || !record) return;
    (async () => {
      const meta = await apiFetch<{ entities: EntityDef[] }>(`/meta`);
      const groups: RelatedGroup[] = [];
      for (const child of meta.entities) {
        const refField = child.fields.find(
          (f) => f.type === "reference" && f.referenceEntity === entity.name,
        );
        if (!refField) continue;
        const page = await apiFetch<{ items: EntityRecord[] }>(
          `/entities/${child.name}?filter.${refField.name}=${record.id}&pageSize=50`,
        );
        if (page.items.length) {
          groups.push({
            entity: child.name,
            label: child.pluralLabel,
            items: page.items.map((r) => ({ id: r.id, title: String(r[child.titleField] ?? r.id) })),
          });
        }
      }
      setRelated(groups);
    })().catch(() => setRelated([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, record]);

  function startEdit() {
    if (!record) return;
    const initial: Record<string, unknown> = {};
    for (const f of editableFields(entity, record)) initial[f.name] = record[f.name];
    setForm(initial);
    setErrors({});
    setEditing(true);
  }

  async function save() {
    if (!record) return;
    setBusy(true);
    setErrors({});
    try {
      await apiFetch(`/entities/${entity.name}/${record.id}`, {
        method: "PATCH",
        body: form,
        headers: { "if-match": String(record.version) },
      });
      toast.success(`${entityName} ${t("common.updated")}`);
      setEditing(false);
      await loadDetail(record.id);
      onChanged();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setErrors(e.fieldErrors());
        toast.error(e.message);
      } else toast.error(t("common.somethingWrong"));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(action: string) {
    if (!record) return;
    setBusy(true);
    try {
      await apiFetch(`/entities/${entity.name}/${record.id}/transitions`, {
        method: "POST",
        body: { action },
      });
      toast.success(t("drawer.actionOk", { entity: entityName, action: t(`action.${action}`) }));
      await loadDetail(record.id);
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!record) return;
    setBusy(true);
    try {
      await apiFetch(`/entities/${entity.name}/${record.id}`, {
        method: "DELETE",
        headers: { "if-match": String(record.version) },
      });
      toast.success(`${entityName} ${t("common.deleted")}`);
      onClose();
      onChanged();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const title = record ? String(record[entity.titleField] ?? entityName) : entityName;

  /** True when the inline edit form has changes that haven't been saved. */
  function isDirty(): boolean {
    if (!editing || !record) return false;
    return editableFields(entity, record).some(
      (f) => JSON.stringify(record[f.name] ?? null) !== JSON.stringify(form[f.name] ?? null),
    );
  }

  /** Guard accidental close (Escape / backdrop / ✕) when there are unsaved edits. */
  function requestClose() {
    if (isDirty() && !window.confirm(t("drawer.unsavedConfirm"))) return;
    onClose();
  }

  return (
    <Drawer
      open={recordId !== null}
      onClose={requestClose}
      title={title}
      footer={
        record && !editing && canDelete ? (
          confirmingDelete ? (
            <div className="flex w-full items-center justify-between gap-2">
              <span className="text-xs text-muted">{t("drawer.deleteConfirm", { entity: entityName })}</span>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => setConfirmingDelete(false)} disabled={busy}>
                  {t("common.cancel")}
                </Button>
                <Button variant="danger" size="sm" loading={busy} onClick={remove}>
                  <Icon name="trash" className="h-3.5 w-3.5" /> {t("common.confirm")}
                </Button>
              </div>
            </div>
          ) : (
            <Button variant="danger" size="sm" onClick={() => setConfirmingDelete(true)}>
              <Icon name="trash" className="h-3.5 w-3.5" /> {t("common.delete")}
            </Button>
          )
        ) : undefined
      }
    >
      {!record ? (
        <p className="text-sm text-muted">{t("common.loading")}</p>
      ) : (
        <div className="space-y-4">
          {actions.length > 0 && !editing && (
            <div className="flex flex-wrap gap-2">
              {actions.map((a) => (
                <Button key={a.action} size="sm" loading={busy} onClick={() => runAction(a.action)}>
                  {t(`action.${a.action}`)}
                </Button>
              ))}
            </div>
          )}

          <Tabs items={tabs} value={tab} onChange={setTab} />

          {tab === "details" &&
            (editing ? (
              <div>
                {editableFields(entity, record).map((f) => (
                  <FieldInput
                    key={f.name}
                    field={f}
                    entityName={entity.name}
                    value={form[f.name]}
                    error={errors[f.name]}
                    options={lookups.options[f.name]}
                    suggestions={lookups.suggestions[f.name]}
                    onChange={(v) => setForm((prev) => ({ ...prev, [f.name]: v }))}
                  />
                ))}
                <div className="mt-2 flex justify-end gap-2">
                  <Button size="sm" onClick={() => setEditing(false)}>
                    {t("common.cancel")}
                  </Button>
                  <Button variant="primary" size="sm" loading={busy} onClick={save}>
                    {t("common.save")}
                  </Button>
                </div>
              </div>
            ) : (
              <div>
                {canUpdate && (
                  <div className="mb-2 flex justify-end">
                    <Button size="sm" onClick={startEdit}>
                      <Icon name="edit" className="h-3.5 w-3.5" /> {t("common.edit")}
                    </Button>
                  </div>
                )}
                <dl className="space-y-2">
                  {entity.fields.map((f) => {
                    const refLabel =
                      (f.type === "reference" || f.personPicker) && record[f.name]
                        ? lookups.options[f.name]?.find((o) => o.value === String(record[f.name]))?.label
                        : undefined;
                    return (
                      <div key={f.name} className="flex justify-between gap-4 border-b border-border pb-1.5">
                        <dt className="text-xs text-muted">{fieldLabel(f, entity.name)}</dt>
                        <dd className="text-right text-sm">
                          {f.type === "reference" || f.personPicker ? (
                            // Show the resolved person/record name, never the raw ref.
                            <span>{refLabel ?? "—"}</span>
                          ) : (
                            <ValueCell field={f} value={record[f.name] ?? null} locale={locale} />
                          )}
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>
            ))}

          {tab === "activity" && (
            <ol className="space-y-2 border-l border-border pl-3">
              {audit.map((a) => (
                <li key={a.id} className="relative text-xs">
                  <span className="absolute -left-[1.45rem] top-1 h-1.5 w-1.5 rounded-full bg-primary" />
                  <span className="text-foreground">{a.summary}</span>
                  <div className="text-muted">{new Date(a.at).toLocaleString()}</div>
                </li>
              ))}
              {audit.length === 0 && <li className="text-xs text-muted">{t("drawer.noHistory")}</li>}
            </ol>
          )}

          {tab === "related" && (
            <div className="space-y-4">
              {related === null ? (
                <p className="text-sm text-muted">{t("common.loading")}</p>
              ) : related.length === 0 ? (
                <p className="text-sm text-muted">{t("drawer.noRelated")}</p>
              ) : (
                related.map((g) => (
                  <div key={g.entity}>
                    <h4 className="mb-1 text-xs font-semibold uppercase text-muted">{g.label}</h4>
                    <ul className="space-y-1">
                      {g.items.map((it) => (
                        <li key={it.id}>
                          <Link
                            href={`/${g.entity}?focus=${it.id}`}
                            onClick={onClose}
                            className="text-sm text-primary hover:underline"
                          >
                            {it.title}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </Drawer>
  );
}

/** Editable fields for the inline form: writable, not lifecycle-managed, and
 *  present in the (possibly field-projected) record. */
function editableFields(entity: EntityDef, record: EntityRecord): FieldDef[] {
  return entity.fields.filter(
    (f) => !f.readOnly && !f.computed && f.name !== entity.lifecycle?.field && f.name in record,
  );
}
