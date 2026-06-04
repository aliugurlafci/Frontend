"use client";

import type { FieldDef } from "@/lib/metadata/types";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n/context";

export function FieldInput({
  field,
  value,
  error,
  onChange,
  options,
  suggestions,
  entityName,
}: {
  field: FieldDef;
  value: unknown;
  error?: string;
  onChange: (value: unknown) => void;
  /** Selectable options for `reference` fields (referenced records). */
  options?: { value: string; label: string }[];
  /** Datalist values for `suggest` string fields. */
  suggestions?: string[];
  /** Owning entity name — enables entity-specific label translations. */
  entityName?: string;
}) {
  const { fieldLabel } = useI18n();
  const id = `f_${field.name}`;
  const str = value === null || value === undefined ? "" : String(value);
  const invalid = Boolean(error);
  const opts = options ?? [];

  return (
    <div className="mb-3">
      <Label htmlFor={id} required={field.required}>
        {fieldLabel(field, entityName)}
      </Label>

      {field.type === "enum" ? (
        <Select id={id} invalid={invalid} value={str} onChange={(e) => onChange(e.target.value || null)}>
          {!field.required && <option value="">—</option>}
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : field.type === "reference" ? (
        <Select id={id} invalid={invalid} value={str} onChange={(e) => onChange(e.target.value || null)}>
          <option value="">—</option>
          {/* Keep the current value visible even if options haven't loaded yet. */}
          {str && !opts.some((o) => o.value === str) && <option value={str}>{str}</option>}
          {opts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </Select>
      ) : field.type === "boolean" ? (
        <Select id={id} invalid={invalid} value={str} onChange={(e) => onChange(e.target.value === "true")}>
          <option value="false">No</option>
          <option value="true">Yes</option>
        </Select>
      ) : field.type === "text" ? (
        <Textarea id={id} invalid={invalid} value={str} onChange={(e) => onChange(e.target.value)} />
      ) : field.suggest ? (
        <>
          <Input
            id={id}
            list={`${id}-dl`}
            invalid={invalid}
            value={str}
            onChange={(e) => onChange(e.target.value)}
          />
          <datalist id={`${id}-dl`}>
            {(suggestions ?? []).map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </>
      ) : (
        <Input
          id={id}
          invalid={invalid}
          type={
            field.type === "number" || field.type === "currency" || field.type === "percent"
              ? "number"
              : field.type === "date"
                ? "date"
                : field.type === "email"
                  ? "email"
                  : "text"
          }
          value={str}
          onChange={(e) => {
            const v = e.target.value;
            if (field.type === "number" || field.type === "currency" || field.type === "percent") {
              onChange(v === "" ? null : Number(v));
            } else onChange(v);
          }}
        />
      )}
      {error ? (
        <p className="mt-1 text-xs text-danger">{error}</p>
      ) : (
        field.helpText && <p className="mt-1 text-xs text-muted">{field.helpText}</p>
      )}
    </div>
  );
}
