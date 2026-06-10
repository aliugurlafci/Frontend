"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Label } from "@/components/ui/input";
import { Icon } from "@/components/ui/icon";
import { DropdownMenu, MenuItem } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils/cn";
import { useI18n } from "@/lib/i18n/context";
import type {
  ActionType,
  AutomationAction,
  AutomationCatalog,
  AutomationRule,
  AutomationTrigger,
  CatalogEntity,
  CatalogField,
  CatalogUser,
  ConditionGroup,
  ConditionLeaf,
  TriggerEvent,
  TriggerKind,
} from "./types";
import { ACTION_ICON } from "./types";

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `a_${Math.round(Math.random() * 1e9)}`);

function emptyGroup(): ConditionGroup {
  return { type: "group", logic: "AND", children: [] };
}

function newAction(type: ActionType): AutomationAction {
  const base: AutomationAction = { id: uid(), type };
  if (type === "branch") return { ...base, condition: emptyGroup(), thenActions: [], elseActions: [] };
  if (type === "parallel") return { ...base, lanes: [[], []] };
  if (type === "delay") return { ...base, delayMinutes: 60 };
  if (type === "create_reminder") return { ...base, reminderInDays: 3 };
  if (type === "ai_score") return { ...base, model: "account-propensity", field: "score" };
  return base;
}

// ---- condition editor (recursive) ------------------------------------------

type Translate = (key: string, vars?: Record<string, string>) => string;
type FieldKind = "text" | "number" | "date" | "boolean" | "enum" | "reference";

/** Collapse the many metadata field types into a handful of editor "kinds". */
function fieldKind(type: string | undefined): FieldKind {
  if (type === "number" || type === "currency" || type === "percent") return "number";
  if (type === "date" || type === "datetime") return "date";
  if (type === "boolean") return "boolean";
  if (type === "enum") return "enum";
  if (type === "reference") return "reference";
  return "text"; // string / text / email / phone / url
}

/** Operators offered per field kind — only the ones that make sense, in a
 *  sensible order, so the picker isn't a confusing wall of options. */
const OPS_BY_KIND: Record<FieldKind, string[]> = {
  text: ["eq", "ne", "contains", "not_contains", "in", "is_empty", "is_not_empty", "changed"],
  number: ["eq", "ne", "gt", "gte", "lt", "lte", "is_empty", "is_not_empty", "changed"],
  date: ["eq", "lt", "lte", "gt", "gte", "is_empty", "is_not_empty", "changed"],
  boolean: ["eq", "changed"],
  enum: ["eq", "ne", "in", "is_empty", "is_not_empty", "changed"],
  reference: ["eq", "ne", "is_empty", "is_not_empty", "changed"],
};

/** Human operator label — date fields read as before/after rather than </>. */
function opLabel(op: string, kind: FieldKind, t: Translate): string {
  if (kind === "date") {
    const map: Record<string, string> = { eq: "auto.op.onDate", lt: "auto.op.before", lte: "auto.op.onBefore", gt: "auto.op.after", gte: "auto.op.onAfter" };
    if (map[op]) return t(map[op]);
  }
  return t(`auto.op.${op}`);
}

/** The value control adapts to the field kind (number / date / boolean / enum / text). */
function ConditionValue({
  leaf,
  fieldDef,
  kind,
  onChange,
}: {
  leaf: ConditionLeaf;
  fieldDef?: CatalogField;
  kind: FieldKind;
  onChange: (c: ConditionLeaf) => void;
}) {
  const { t } = useI18n();
  const v = String(leaf.value ?? "");
  const set = (value: string) => onChange({ ...leaf, value });
  if (leaf.op === "in") {
    return <Input value={v} onChange={(e) => set(e.target.value)} placeholder={t("auto.cond.inListPh")} className="h-8 w-44 text-xs" />;
  }
  if (fieldDef?.options?.length) {
    return (
      <Select value={v} onChange={(e) => set(e.target.value)} className="h-8 w-auto text-xs">
        <option value="">{t("auto.cond.pickValue")}</option>
        {fieldDef.options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </Select>
    );
  }
  if (kind === "boolean") {
    return (
      <Select value={v === "false" ? "false" : "true"} onChange={(e) => set(e.target.value)} className="h-8 w-auto text-xs">
        <option value="true">{t("auto.cond.true")}</option>
        <option value="false">{t("auto.cond.false")}</option>
      </Select>
    );
  }
  if (kind === "number") {
    return <Input type="number" value={v} onChange={(e) => set(e.target.value)} placeholder={t("auto.cond.valuePh")} className="h-8 w-28 text-xs" />;
  }
  if (kind === "date") {
    return <Input type={fieldDef?.type === "datetime" ? "datetime-local" : "date"} value={v} onChange={(e) => set(e.target.value)} className="h-8 w-auto text-xs" />;
  }
  if (kind === "reference") {
    return <Input value={v} onChange={(e) => set(e.target.value)} placeholder={t("auto.cond.refIdPh")} className="h-8 w-32 text-xs" />;
  }
  return <Input value={v} onChange={(e) => set(e.target.value)} placeholder={t("auto.cond.valuePh")} className="h-8 w-44 text-xs" />;
}

/** One "field — operator — value" condition row, type-aware throughout. */
function ConditionLeafRow({
  leaf,
  fields,
  catalog,
  onChange,
  onRemove,
}: {
  leaf: ConditionLeaf;
  fields: CatalogField[];
  catalog: AutomationCatalog;
  onChange: (c: ConditionLeaf) => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const unarySet = new Set(catalog.operators.filter((o) => o.unary).map((o) => o.value));
  const fieldDef = fields.find((f) => f.name === leaf.field);
  const kind = fieldKind(fieldDef?.type);
  const ops = OPS_BY_KIND[kind]
    .map((v) => catalog.operators.find((o) => o.value === v))
    .filter((o): o is AutomationCatalog["operators"][number] => Boolean(o));
  const isUnary = unarySet.has(leaf.op);

  function setField(name: string) {
    const nk = fieldKind(fields.find((f) => f.name === name)?.type);
    const allowed = OPS_BY_KIND[nk];
    const op = (allowed.includes(leaf.op) ? leaf.op : allowed[0]) as ConditionLeaf["op"];
    onChange({ ...leaf, field: name, op, value: nk === "boolean" ? "true" : "" });
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border bg-surface/50 p-1.5">
      <Select value={leaf.field} onChange={(e) => setField(e.target.value)} className="h-8 w-auto min-w-32 text-xs">
        {fields.length === 0 && <option value="">{t("auto.cond.fieldPh")}</option>}
        {fields.map((f) => (
          <option key={f.name} value={f.name}>{f.label}</option>
        ))}
      </Select>
      <Select value={leaf.op} onChange={(e) => onChange({ ...leaf, op: e.target.value as ConditionLeaf["op"], value: unarySet.has(e.target.value) ? "" : leaf.value })} className="h-8 w-auto text-xs">
        {ops.map((o) => (
          <option key={o.value} value={o.value}>{opLabel(o.value, kind, t)}</option>
        ))}
      </Select>
      {!isUnary && <ConditionValue leaf={leaf} fieldDef={fieldDef} kind={kind} onChange={onChange} />}
      <button
        onClick={onRemove}
        aria-label={t("auto.cond.removeCondition")}
        title={t("auto.cond.removeCondition")}
        className="ml-auto rounded p-1 text-muted-2 hover:bg-danger/10 hover:text-danger"
      >
        <Icon name="close" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function ConditionGroupEditor({
  group,
  onChange,
  onRemove,
  entity,
  catalog,
  depth = 0,
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  onRemove?: () => void;
  entity?: CatalogEntity;
  catalog: AutomationCatalog;
  depth?: number;
}) {
  const { t } = useI18n();
  const fields = entity?.fields ?? [];

  function setChild(i: number, child: ConditionLeaf | ConditionGroup) {
    const children = [...group.children];
    children[i] = child;
    onChange({ ...group, children });
  }
  function remove(i: number) {
    onChange({ ...group, children: group.children.filter((_, idx) => idx !== i) });
  }
  function addLeaf() {
    const f = fields[0]?.name ?? "";
    onChange({ ...group, children: [...group.children, { type: "condition", field: f, op: "eq", value: "" }] });
  }
  function addGroup() {
    onChange({ ...group, children: [...group.children, emptyGroup()] });
  }

  return (
    <div className={cn("rounded-xl border p-3", depth > 0 ? "border-border bg-surface-2/40" : "border-border-strong bg-surface/30")}>
      {/* Match ALL / ANY of these conditions */}
      <div className="mb-2.5 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted">{depth === 0 ? t("auto.cond.if") : t("auto.cond.subgroup")}</span>
        <div className="glass inline-flex rounded-lg p-0.5 text-xs">
          {(["AND", "OR"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ ...group, logic: l })}
              className={cn(
                "rounded-md px-2.5 py-1 font-semibold transition-colors",
                group.logic === l ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {l === "AND" ? t("auto.cond.all") : t("auto.cond.any")}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-2">{t("auto.cond.ofThese")}</span>
        {onRemove && (
          <button
            onClick={onRemove}
            aria-label={t("auto.cond.removeGroup")}
            title={t("auto.cond.removeGroup")}
            className="ml-auto rounded p-1 text-muted-2 hover:bg-danger/10 hover:text-danger"
          >
            <Icon name="trash" className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {group.children.length === 0 && (
        <p className="rounded-lg border border-dashed border-border bg-surface-2/30 px-3 py-2 text-xs text-muted-2">{t("auto.cond.emptyHint")}</p>
      )}

      <div className="space-y-2">
        {group.children.map((child, i) =>
          child.type === "group" ? (
            <ConditionGroupEditor
              key={i}
              group={child}
              onChange={(g) => setChild(i, g)}
              onRemove={() => remove(i)}
              entity={entity}
              catalog={catalog}
              depth={depth + 1}
            />
          ) : (
            <ConditionLeafRow
              key={i}
              leaf={child}
              fields={fields}
              catalog={catalog}
              onChange={(c) => setChild(i, c)}
              onRemove={() => remove(i)}
            />
          ),
        )}
      </div>

      <div className="mt-2.5 flex gap-1.5">
        <Button size="xs" variant="outline" onClick={addLeaf}>
          <Icon name="plus" className="h-3 w-3" /> {t("auto.cond.addCondition")}
        </Button>
        {depth < 2 && (
          <Button size="xs" variant="ghost" onClick={addGroup}>
            <Icon name="plus" className="h-3 w-3" /> {t("auto.cond.addGroup")}
          </Button>
        )}
      </div>
    </div>
  );
}

// ---- action editor (recursive) ---------------------------------------------

const TOKEN_FIELD =
  "w-full rounded-lg border border-border-strong bg-surface/60 px-3 py-1.5 text-xs text-foreground placeholder:text-muted-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:border-ring";

/** Icon hint for a record field by type (used in the insert-field picker). */
function fieldIcon(type: string): string {
  if (type === "email") return "email";
  if (type === "phone") return "call";
  if (type === "url") return "globe";
  if (type === "reference") return "users";
  if (type === "date" || type === "datetime") return "calendar";
  return "edit";
}

/**
 * Text input / textarea with a "+ field" picker that inserts a `{{record.field}}`
 * token at the caret — so a user can drop the triggering record's email, name,
 * etc. into a message without remembering the template syntax. (e.g. for "email
 * the user that was created", pick the Email field → `{{record.email}}`.)
 */
function FieldTokenInput({
  value,
  onChange,
  placeholder,
  entity,
  multiline,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  entity?: CatalogEntity;
  multiline?: boolean;
}) {
  const { t } = useI18n();
  const ref = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const fields = entity?.fields ?? [];

  function insert(name: string) {
    const token = `{{record.${name}}}`;
    const el = ref.current;
    if (el && typeof el.selectionStart === "number") {
      const start = el.selectionStart;
      const end = el.selectionEnd ?? start;
      onChange(value.slice(0, start) + token + value.slice(end));
      requestAnimationFrame(() => {
        el.focus();
        const pos = start + token.length;
        el.setSelectionRange(pos, pos);
      });
    } else {
      onChange(value ? `${value}${token}` : token);
    }
  }

  return (
    <div className="relative">
      {multiline ? (
        <textarea ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(TOKEN_FIELD, "min-h-14 pr-9")} />
      ) : (
        <input ref={ref} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={cn(TOKEN_FIELD, "h-8 pr-9")} />
      )}
      {fields.length > 0 && (
        <div className="absolute right-1 top-1">
          <DropdownMenu
            align="end"
            panelClassName="w-60 max-h-72 overflow-y-auto"
            trigger={({ toggle }) => (
              <button
                type="button"
                onClick={toggle}
                title={t("auto.cfg.insertField")}
                aria-label={t("auto.cfg.insertField")}
                className="flex h-6 items-center gap-1 rounded-md border border-border bg-surface px-1.5 text-[10px] font-medium text-muted-2 hover:border-primary/40 hover:text-primary"
              >
                <Icon name="plus" className="h-3 w-3" /> {t("auto.cfg.field")}
              </button>
            )}
          >
            {({ close }) => (
              <>
                <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-2">{t("auto.cfg.insertFieldHint")}</div>
                {fields.map((f) => (
                  <MenuItem key={f.name} onClick={() => { insert(f.name); close(); }}>
                    <Icon name={fieldIcon(f.type)} className="h-3.5 w-3.5 text-muted" />
                    <span className="flex-1 truncate">{f.label}</span>
                    <code className="text-[10px] text-muted-2">{f.name}</code>
                  </MenuItem>
                ))}
              </>
            )}
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}

function ActionConfig({
  action,
  onChange,
  entity,
  catalog,
  users,
}: {
  action: AutomationAction;
  onChange: (a: AutomationAction) => void;
  entity?: CatalogEntity;
  catalog: AutomationCatalog;
  users: CatalogUser[];
}) {
  const { t } = useI18n();
  const set = (patch: Partial<AutomationAction>) => onChange({ ...action, ...patch });
  const fields = entity?.fields ?? [];

  switch (action.type) {
    case "send_email":
    case "send_sms":
    case "send_whatsapp":
    case "notify":
      return (
        <div className="space-y-2">
          {action.type !== "notify" && (
            <div>
              <Label>{action.type === "send_email" ? t("auto.cfg.toEmail") : t("auto.cfg.to")}</Label>
              <FieldTokenInput
                value={action.to ?? ""}
                onChange={(to) => set({ to })}
                placeholder={action.type === "send_email" ? t("auto.cfg.toEmailPh") : t("auto.cfg.toPh")}
                entity={entity}
              />
            </div>
          )}
          <div>
            <Label>{t("auto.cfg.subject")}</Label>
            <FieldTokenInput value={action.subject ?? ""} onChange={(subject) => set({ subject })} placeholder={t("auto.cfg.subject")} entity={entity} />
          </div>
          <div>
            <Label>{t("auto.cfg.body")}</Label>
            <FieldTokenInput value={action.body ?? ""} onChange={(body) => set({ body })} placeholder={t("auto.cfg.body")} entity={entity} multiline />
          </div>
          {entity && entity.fields.length > 0 && <p className="text-[11px] text-muted-2">{t("auto.cfg.tokenHint")}</p>}
        </div>
      );
    case "create_task":
      return (
        <FieldTokenInput value={action.taskSubject ?? ""} onChange={(taskSubject) => set({ taskSubject })} placeholder={t("auto.cfg.taskSubject")} entity={entity} />
      );
    case "create_reminder":
      return (
        <label className="flex items-center gap-2 text-xs text-muted">
          {t("auto.cfg.remindIn")}
          <Input type="number" value={action.reminderInDays ?? 3} onChange={(e) => set({ reminderInDays: Number(e.target.value) })} className="h-8 w-20 text-xs" />
          {t("auto.cfg.days")}
        </label>
      );
    case "assign_owner":
      return (
        <Select value={action.assignTo ?? ""} onChange={(e) => set({ assignTo: e.target.value })} className="h-8 text-xs">
          <option value="">{t("auto.cfg.useAssignmentRule")}</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.displayName}
            </option>
          ))}
        </Select>
      );
    case "update_stage":
      return (
        <Select value={action.stage ?? ""} onChange={(e) => set({ stage: e.target.value })} className="h-8 text-xs">
          <option value="">{t("auto.cfg.selectStage")}</option>
          {(entity?.lifecycleStates ?? []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      );
    case "update_record":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={action.field ?? ""} onChange={(e) => set({ field: e.target.value })} className="h-8 text-xs">
            <option value="">{t("auto.cfg.field")}</option>
            {fields.map((f) => (
              <option key={f.name} value={f.name}>
                {f.label}
              </option>
            ))}
          </Select>
          <FieldTokenInput value={action.value ?? ""} onChange={(value) => set({ value })} placeholder={t("auto.cfg.value")} entity={entity} />
        </div>
      );
    case "create_record": {
      const target = catalog.entities.find((en) => en.name === action.entity);
      // Migrate a legacy single field/value into the assignments list on first view.
      const assignments = action.assignments ?? (action.field ? [{ field: action.field, value: action.value ?? "" }] : []);
      const setAssignment = (i: number, patch: Partial<{ field: string; value: string }>) =>
        set({ assignments: assignments.map((a, idx) => (idx === i ? { ...a, ...patch } : a)) });
      return (
        <div className="space-y-2">
          <div>
            <Label>{t("auto.cfg.createEntity")}</Label>
            <Select value={action.entity ?? ""} onChange={(e) => set({ entity: e.target.value, assignments: [] })} className="h-8 text-xs">
              <option value="">{t("auto.cfg.entity")}</option>
              {catalog.entities.map((en) => (
                <option key={en.name} value={en.name}>{en.label}</option>
              ))}
            </Select>
          </div>
          {action.entity && (
            <div className="space-y-1.5">
              <Label>{t("auto.cfg.setFields")}</Label>
              {assignments.length === 0 && <p className="text-[11px] text-muted-2">{t("auto.cfg.setFieldsHint")}</p>}
              {assignments.map((a, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <Select value={a.field} onChange={(e) => setAssignment(i, { field: e.target.value })} className="h-8 w-40 text-xs">
                    <option value="">{t("auto.cfg.field")}</option>
                    {(target?.fields ?? []).map((f) => (
                      <option key={f.name} value={f.name}>{f.label}</option>
                    ))}
                  </Select>
                  <div className="min-w-0 flex-1">
                    <FieldTokenInput value={a.value} onChange={(value) => setAssignment(i, { value })} placeholder={t("auto.cfg.value")} entity={entity} />
                  </div>
                  <button
                    onClick={() => set({ assignments: assignments.filter((_, idx) => idx !== i) })}
                    aria-label={t("auto.cfg.removeField")}
                    className="shrink-0 rounded p-1 text-muted-2 hover:bg-danger/10 hover:text-danger"
                  >
                    <Icon name="close" className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <Button size="xs" variant="outline" onClick={() => set({ assignments: [...assignments, { field: "", value: "" }] })}>
                <Icon name="plus" className="h-3 w-3" /> {t("auto.cfg.addField")}
              </Button>
            </div>
          )}
        </div>
      );
    }
    case "webhook":
      return (
        <Input value={action.url ?? ""} onChange={(e) => set({ url: e.target.value })} placeholder={t("auto.cfg.urlPh")} className="h-8 text-xs" />
      );
    case "delay":
      return (
        <label className="flex items-center gap-2 text-xs text-muted">
          {t("auto.cfg.wait")}
          <Input type="number" value={action.delayMinutes ?? 60} onChange={(e) => set({ delayMinutes: Number(e.target.value) })} className="h-8 w-24 text-xs" />
          {t("auto.cfg.minutes")}
        </label>
      );
    case "ai_score":
      return (
        <div className="grid grid-cols-2 gap-2">
          <Select value={action.model ?? "account-propensity"} onChange={(e) => set({ model: e.target.value })} className="h-8 text-xs">
            <option value="account-propensity">{t("auto.cfg.model.leadProp")}</option>
            <option value="deal-win">{t("auto.cfg.model.dealWin")}</option>
            <option value="churn-risk">{t("auto.cfg.model.churn")}</option>
          </Select>
          <Input value={action.field ?? "score"} onChange={(e) => set({ field: e.target.value })} placeholder={t("auto.cfg.writeToField")} className="h-8 text-xs" />
        </div>
      );
    case "branch":
      return (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">{t("auto.branch.ifMatch")}</p>
          <ConditionGroupEditor group={action.condition ?? emptyGroup()} onChange={(g) => set({ condition: g })} entity={entity} catalog={catalog} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-xl border border-success/30 bg-success/5 p-2">
              <p className="mb-1.5 text-xs font-semibold text-success">{t("auto.branch.then")}</p>
              <ActionListEditor actions={action.thenActions ?? []} onChange={(a) => set({ thenActions: a })} entity={entity} catalog={catalog} users={users} depth={1} />
            </div>
            <div className="rounded-xl border border-border bg-surface-2/40 p-2">
              <p className="mb-1.5 text-xs font-semibold text-muted">{t("auto.branch.else")}</p>
              <ActionListEditor actions={action.elseActions ?? []} onChange={(a) => set({ elseActions: a })} entity={entity} catalog={catalog} users={users} depth={1} />
            </div>
          </div>
        </div>
      );
    case "parallel":
      return (
        <div className="space-y-2">
          {(action.lanes ?? []).map((lane, li) => (
            <div key={li} className="rounded-xl border border-info/30 bg-info/5 p-2">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-semibold text-info">{t("auto.parallel.lane", { n: String(li + 1) })}</p>
                <button
                  onClick={() => set({ lanes: (action.lanes ?? []).filter((_, idx) => idx !== li) })}
                  className="rounded p-0.5 text-muted-2 hover:text-danger"
                  aria-label="Remove lane"
                >
                  <Icon name="close" className="h-3 w-3" />
                </button>
              </div>
              <ActionListEditor
                actions={lane}
                onChange={(a) => {
                  const lanes = [...(action.lanes ?? [])];
                  lanes[li] = a;
                  set({ lanes });
                }}
                entity={entity}
                catalog={catalog}
                users={users}
                depth={1}
              />
            </div>
          ))}
          <Button size="xs" variant="outline" onClick={() => set({ lanes: [...(action.lanes ?? []), []] })}>
            <Icon name="plus" className="h-3 w-3" /> {t("auto.parallel.addLane")}
          </Button>
        </div>
      );
    default:
      return null;
  }
}

function ActionListEditor({
  actions,
  onChange,
  entity,
  catalog,
  users,
  depth = 0,
}: {
  actions: AutomationAction[];
  onChange: (a: AutomationAction[]) => void;
  entity?: CatalogEntity;
  catalog: AutomationCatalog;
  users: CatalogUser[];
  depth?: number;
}) {
  const { t } = useI18n();
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  function update(i: number, a: AutomationAction) {
    const next = [...actions];
    next[i] = a;
    onChange(next);
  }
  function remove(i: number) {
    onChange(actions.filter((_, idx) => idx !== i));
  }
  function move(from: number, to: number) {
    if (to < 0 || to >= actions.length) return;
    const next = [...actions];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  }
  function add(type: ActionType) {
    onChange([...actions, newAction(type)]);
  }

  const grouped = catalog.actionTypes.reduce<Record<string, typeof catalog.actionTypes>>((acc, a) => {
    (acc[a.group] ??= []).push(a);
    return acc;
  }, {});

  return (
    <div className="space-y-2">
      {actions.map((action, i) => {
        const label = t(`auto.act.${action.type}`);
        return (
          <div
            key={action.id}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn(
              "animate-rise rounded-xl border border-border bg-surface p-2.5 shadow-sm backdrop-blur-sm transition-all hover:border-primary/30 hover:shadow-md",
              dragIndex === i && "opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              {/* Only the grip is draggable, so the action's buttons (config /
                  move / remove) stay reliably clickable. */}
              <span
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragEnd={() => setDragIndex(null)}
                className="cursor-grab text-muted-2"
                title="Drag to reorder"
              >
                <Icon name="sort" className="h-3.5 w-3.5" />
              </span>
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Icon name={ACTION_ICON[action.type]} className="h-3.5 w-3.5" />
              </span>
              <span className="text-sm font-medium">{label}</span>
              <span className="ml-auto flex items-center gap-0.5">
                <button onClick={() => move(i, i - 1)} disabled={i === 0} className="rounded p-1 text-muted-2 hover:text-foreground disabled:opacity-30" aria-label="Move up">
                  <Icon name="sortAsc" className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => move(i, i + 1)} disabled={i === actions.length - 1} className="rounded p-1 text-muted-2 hover:text-foreground disabled:opacity-30" aria-label="Move down">
                  <Icon name="sortDesc" className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => remove(i)} className="rounded p-1 text-muted-2 hover:bg-danger/10 hover:text-danger" aria-label="Remove action">
                  <Icon name="trash" className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
            <div className="mt-2 pl-9">
              <ActionConfig action={action} onChange={(a) => update(i, a)} entity={entity} catalog={catalog} users={users} />
            </div>
          </div>
        );
      })}

      <DropdownMenu
        trigger={({ toggle }) => (
          <Button size="xs" variant="outline" onClick={toggle}>
            <Icon name="plus" className="h-3 w-3" /> {t("auto.action.add")}
          </Button>
        )}
        panelClassName="w-60 max-h-72 overflow-y-auto"
      >
        {({ close }) => (
          <>
            {Object.entries(grouped).map(([groupName, items]) => (
              <div key={groupName}>
                <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted-2">{t(`auto.ag.${groupName}`)}</div>
                {items
                  .filter((it) => depth === 0 || (it.value !== "branch" && it.value !== "parallel"))
                  .map((it) => (
                    <MenuItem
                      key={it.value}
                      onClick={() => {
                        add(it.value as ActionType);
                        close();
                      }}
                    >
                      <Icon name={ACTION_ICON[it.value as ActionType]} className="h-3.5 w-3.5 text-muted" />
                      <span className="flex-1">{t(`auto.act.${it.value}`)}</span>
                    </MenuItem>
                  ))}
              </div>
            ))}
          </>
        )}
      </DropdownMenu>
    </div>
  );
}

// ---- builder shell ---------------------------------------------------------

export function AutomationBuilder({
  rule,
  catalog,
  users,
  onClose,
  onSaved,
}: {
  rule: AutomationRule | null;
  catalog: AutomationCatalog;
  users: CatalogUser[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(rule?.name ?? "");
  const [description, setDescription] = useState(rule?.description ?? "");
  const [trigger, setTrigger] = useState<AutomationTrigger>(
    rule?.trigger ?? { kind: "event", entity: catalog.entities[0]?.name, event: "created" },
  );
  const [conditions, setConditions] = useState<ConditionGroup>(rule?.conditions ?? emptyGroup());
  const [actions, setActions] = useState<AutomationAction[]>(rule?.actions ?? []);
  const [busy, setBusy] = useState(false);
  // Portal needs a client DOM target; mount-gate avoids SSR/hydration use.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const entity = catalog.entities.find((e) => e.name === trigger.entity);

  async function save(activate: boolean) {
    if (!name.trim()) {
      toast.error(t("auto.toast.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      const payload = { name, description, trigger, conditions, actions, requiresApproval: false };
      let saved: AutomationRule;
      if (rule) {
        saved = await apiFetch<AutomationRule>(`/automations/${rule.id}`, { method: "PATCH", body: payload });
      } else {
        saved = await apiFetch<AutomationRule>(`/automations`, { method: "POST", body: { ...payload, status: "draft" } });
      }
      if (activate) {
        await apiFetch(`/automations/${saved.id}/status`, { method: "POST", body: { status: "active" } });
      }
      toast.success(activate ? t("auto.toast.activated") : t("auto.toast.saved"));
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function rollback(version: number) {
    if (!rule) return;
    try {
      await apiFetch(`/automations/${rule.id}/rollback`, { method: "POST", body: { version } });
      toast.success(t("auto.toast.rolledBack", { v: String(version) }));
      onSaved();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (!mounted) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex justify-end">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("auto.title")}
        className="glass-strong glass-sheen relative flex h-full w-full max-w-3xl flex-col rounded-l-2xl shadow-[var(--shadow-lg)] outline-none animate-rise"
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-foreground">
              <Icon name="recurring" className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold tracking-tight">{rule ? t("auto.builder.edit") : t("auto.builder.new")}</h2>
              {rule && <p className="text-xs text-muted">{t("auto.builder.versionInfo", { v: String(rule.version), n: String(rule.versions.length) })}</p>}
            </div>
          </div>
          <button onClick={onClose} aria-label="Close" className="flex h-7 w-7 items-center justify-center rounded-lg text-muted hover:bg-surface-2 hover:text-foreground">
            ✕
          </button>
        </div>

        {/* body */}
        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="auto-name" required>{t("auto.field.name")}</Label>
              <Input id="auto-name" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("auto.field.namePh")} />
            </div>
            <div>
              <Label htmlFor="auto-desc">{t("auto.field.description")}</Label>
              <Input id="auto-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("auto.field.descriptionPh")} />
            </div>
          </div>

          {/* Trigger node */}
          <FlowNode step={1} icon="activity" title={t("auto.trigger.title")} subtitle={t("auto.trigger.subtitle")}>
            <div className="grid gap-2 sm:grid-cols-3">
              <Select value={trigger.kind} onChange={(e) => setTrigger({ ...trigger, kind: e.target.value as TriggerKind })} className="text-xs">
                {catalog.triggerKinds.map((k) => (
                  <option key={k.value} value={k.value}>
                    {t(`auto.tk.${k.value}`)}
                  </option>
                ))}
              </Select>
              {(trigger.kind === "event" || trigger.kind === "inactivity") && (
                <Select value={trigger.entity ?? ""} onChange={(e) => setTrigger({ ...trigger, entity: e.target.value })} className="text-xs">
                  {catalog.entities.map((en) => (
                    <option key={en.name} value={en.name}>
                      {en.label}
                    </option>
                  ))}
                </Select>
              )}
              {trigger.kind === "event" && (
                <Select value={trigger.event ?? "created"} onChange={(e) => setTrigger({ ...trigger, event: e.target.value as TriggerEvent })} className="text-xs">
                  {catalog.triggerEvents.map((ev) => (
                    <option key={ev.value} value={ev.value}>
                      {t(`auto.ev.${ev.value}`)}
                    </option>
                  ))}
                </Select>
              )}
              {trigger.kind === "schedule" && (
                <Select
                  value={trigger.schedule ?? "daily"}
                  onChange={(e) => {
                    const schedule = e.target.value;
                    setTrigger({ ...trigger, schedule, everyMinutes: schedule === "minutely" ? (trigger.everyMinutes ?? 5) : trigger.everyMinutes });
                  }}
                  className="text-xs"
                >
                  <option value="minutely">{t("auto.sched.minutely")}</option>
                  <option value="hourly">{t("auto.sched.hourly")}</option>
                  <option value="daily">{t("auto.sched.daily")}</option>
                  <option value="weekly">{t("auto.sched.weekly")}</option>
                </Select>
              )}
              {trigger.kind === "schedule" && trigger.schedule === "minutely" && (
                <label className="flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface/60 px-2.5 text-xs text-muted">
                  {t("auto.sched.every")}
                  <input
                    type="number"
                    min={1}
                    value={trigger.everyMinutes ?? 5}
                    onChange={(e) => setTrigger({ ...trigger, everyMinutes: Math.max(1, Number(e.target.value) || 1) })}
                    className="h-7 w-14 rounded border border-border bg-surface/70 px-1 text-center text-foreground focus:outline-none focus-visible:border-ring"
                  />
                  {t("auto.sched.minutesUnit")}
                </label>
              )}
              {trigger.kind === "inactivity" && (
                <Input
                  type="number"
                  value={trigger.inactivityDays ?? 14}
                  onChange={(e) => setTrigger({ ...trigger, inactivityDays: Number(e.target.value) })}
                  placeholder="days"
                  className="text-xs"
                />
              )}
              {trigger.kind === "webhook" && (
                <Input value={trigger.webhookEvent ?? ""} onChange={(e) => setTrigger({ ...trigger, webhookEvent: e.target.value })} placeholder="event name" className="text-xs" />
              )}
            </div>
          </FlowNode>

          <FlowConnector />

          {/* Conditions node */}
          <FlowNode step={2} icon="filter" title={t("auto.conditions.title")} subtitle={t("auto.conditions.subtitle")}>
            <ConditionGroupEditor group={conditions} onChange={setConditions} entity={entity} catalog={catalog} />
          </FlowNode>

          <FlowConnector />

          {/* Actions node */}
          <FlowNode step={3} icon="pipeline" title={t("auto.actions.title")} subtitle={t("auto.actions.subtitle")}>
            <ActionListEditor actions={actions} onChange={setActions} entity={entity} catalog={catalog} users={users} />
          </FlowNode>

          {/* Version history */}
          {rule && rule.versions.length > 1 && (
            <div className="rounded-xl border border-border p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-2">{t("auto.versionHistory")}</p>
              <ul className="space-y-1 text-xs">
                {rule.versions.slice(0, 6).map((v) => (
                  <li key={v.version} className="flex items-center justify-between gap-2">
                    <span>
                      <Badge tone="neutral">v{v.version}</Badge> {v.note} · {new Date(v.at).toLocaleString()}
                    </span>
                    {v.version !== rule.version && (
                      <button onClick={() => rollback(v.version)} className="font-medium text-primary hover:underline">
                        {t("auto.rollback")}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-2 border-t border-border p-4">
          <span className="text-xs text-muted">{t("auto.footer.actions", { n: String(actions.length) })}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t("common.cancel")}
            </Button>
            <Button variant="secondary" loading={busy} onClick={() => save(false)}>
              {t("auto.saveDraft")}
            </Button>
            <Button variant="primary" loading={busy} onClick={() => save(true)}>
              {t("auto.saveActivate")}
            </Button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function FlowNode({
  step,
  icon,
  title,
  subtitle,
  children,
}: {
  step: number;
  icon: string;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className="glass glass-sheen animate-rise rounded-2xl p-3.5 shadow-sm transition-shadow duration-300 hover:shadow-md"
      style={{ animationDelay: `${step * 90}ms` }}
    >
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 text-primary ring-1 ring-primary/15">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">{step}</span>{" "}
            {title}
          </p>
          <p className="text-xs text-muted">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function FlowConnector() {
  return (
    <div className="flex justify-center" aria-hidden>
      <span className="animate-draw-down h-6 w-0.5 rounded-full bg-gradient-to-b from-primary/50 to-secondary/50" />
    </div>
  );
}
