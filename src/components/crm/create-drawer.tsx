"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { EntityDef } from "@/lib/metadata/types";
import { apiFetch, ApiRequestError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Drawer } from "@/components/ui/drawer";
import { FieldInput } from "./field-input";
import { useFieldLookups } from "./field-lookups";
import { useI18n } from "@/lib/i18n/context";

export function CreateDrawer({
  entity,
  open,
  onClose,
  onCreated,
}: {
  entity: EntityDef;
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  // Lifecycle field starts at its initial state — not user-set on create.
  const editable = entity.fields.filter(
    (f) => !f.readOnly && !f.computed && f.name !== entity.lifecycle?.field,
  );
  const [form, setForm] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const lookups = useFieldLookups(entity);
  const { t, entityLabel } = useI18n();
  const entityName = entityLabel(entity);

  async function submit() {
    setBusy(true);
    setErrors({});
    try {
      await apiFetch(`/entities/${entity.name}`, { method: "POST", body: form });
      toast.success(`${entityName} ${t("common.created")}`);
      onCreated();
    } catch (e) {
      if (e instanceof ApiRequestError) {
        setErrors(e.fieldErrors());
        toast.error(e.message);
      } else {
        toast.error(e instanceof Error ? e.message : "Error");
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={t("drawer.newEntity", { entity: entityName })}
      footer={
        <div className="flex justify-end gap-2">
          <Button size="sm" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button variant="primary" size="sm" loading={busy} onClick={submit}>
            {t("common.create")}
          </Button>
        </div>
      }
    >
      {editable.map((f) => (
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
    </Drawer>
  );
}
