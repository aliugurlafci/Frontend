"use client";

import { useState } from "react";
import { toast } from "sonner";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input, Select, Textarea, Label } from "@/components/ui/input";
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
  if (type === "ai_score") return { ...base, model: "lead-propensity", field: "score" };
  return base;
}

// ---- condition editor (recursive) ------------------------------------------

function ConditionGroupEditor({
  group,
  onChange,
  entity,
  catalog,
  depth = 0,
}: {
  group: ConditionGroup;
  onChange: (g: ConditionGroup) => void;
  entity?: CatalogEntity;
  catalog: AutomationCatalog;
  depth?: number;
}) {
  const { t } = useI18n();
  const fields = entity?.fields ?? [];
  const unary = new Set(catalog.operators.filter((o) => o.unary).map((o) => o.value));

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
    <div className={cn("rounded-xl border border-border p-2.5", depth > 0 && "bg-surface-2/40")}>
      <div className="mb-2 flex items-center gap-2">
        <div className="glass inline-flex rounded-lg p-0.5 text-xs">
          {(["AND", "OR"] as const).map((l) => (
            <button
              key={l}
              onClick={() => onChange({ ...group, logic: l })}
              className={cn(
                "rounded-md px-2 py-0.5 font-semibold transition-colors",
                group.logic === l ? "bg-primary text-primary-foreground" : "text-muted hover:text-foreground",
              )}
            >
              {l}
            </button>
          ))}
        </div>
        <span className="text-xs text-muted-2">
          {group.children.length === 0
            ? t("auto.cond.none")
            : group.logic === "AND"
              ? t("auto.cond.matchAll")
              : t("auto.cond.matchAny")}
        </span>
      </div>

      <div className="space-y-2">
        {group.children.map((child, i) =>
          child.type === "group" ? (
            <ConditionGroupEditor
              key={i}
              group={child}
              onChange={(g) => setChild(i, g)}
              entity={entity}
              catalog={catalog}
              depth={depth + 1}
            />
          ) : (
            <div key={i} className="flex flex-wrap items-center gap-1.5">
              <Select
                value={child.field}
                onChange={(e) => setChild(i, { ...child, field: e.target.value })}
                className="h-8 w-auto min-w-32 text-xs"
              >
                {fields.length === 0 && <option value="">{t("auto.cond.fieldPh")}</option>}
                {fields.map((f) => (
                  <option key={f.name} value={f.name}>
                    {f.label}
                  </option>
                ))}
              </Select>
              <Select
                value={child.op}
                onChange={(e) => setChild(i, { ...child, op: e.target.value as ConditionLeaf["op"] })}
                className="h-8 w-auto text-xs"
              >
                {catalog.operators.map((o) => (
                  <option key={o.value} value={o.value}>
                    {t(`auto.op.${o.value}`)}
                  </option>
                ))}
              </Select>
              {!unary.has(child.op) &&
                (() => {
                  const fieldDef = fields.find((f) => f.name === child.field);
                  if (fieldDef?.options?.length) {
                    return (
                      <Select
                        value={String(child.value ?? "")}
                        onChange={(e) => setChild(i, { ...child, value: e.target.value })}
                        className="h-8 w-auto text-xs"
                      >
                        <option value="">—</option>
                        {fieldDef.options.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </Select>
                    );
                  }
                  return (
                    <Input
                      value={String(child.value ?? "")}
                      onChange={(e) => setChild(i, { ...child, value: e.target.value })}
                      placeholder={t("auto.cond.valuePh")}
                      className="h-8 w-32 text-xs"
                    />
                  );
                })()}
              <button
                onClick={() => remove(i)}
                aria-label="Remove condition"
                className="ml-auto rounded p-1 text-muted-2 hover:bg-danger/10 hover:text-danger"
              >
                <Icon name="close" className="h-3.5 w-3.5" />
              </button>
            </div>
          ),
        )}
      </div>

      <div className="mt-2 flex gap-1.5">
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
            <Input value={action.to ?? ""} onChange={(e) => set({ to: e.target.value })} placeholder={t("auto.cfg.to")} className="h-8 text-xs" />
          )}
          <Input value={action.subject ?? ""} onChange={(e) => set({ subject: e.target.value })} placeholder={t("auto.cfg.subject")} className="h-8 text-xs" />
          <Textarea value={action.body ?? ""} onChange={(e) => set({ body: e.target.value })} placeholder={t("auto.cfg.body")} className="min-h-14 text-xs" />
        </div>
      );
    case "create_task":
      return (
        <Input value={action.taskSubject ?? ""} onChange={(e) => set({ taskSubject: e.target.value })} placeholder={t("auto.cfg.taskSubject")} className="h-8 text-xs" />
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
          <Input value={action.value ?? ""} onChange={(e) => set({ value: e.target.value })} placeholder={t("auto.cfg.value")} className="h-8 text-xs" />
        </div>
      );
    case "create_record":
      return (
        <div className="grid grid-cols-3 gap-2">
          <Select value={action.entity ?? ""} onChange={(e) => set({ entity: e.target.value })} className="h-8 text-xs">
            <option value="">{t("auto.cfg.entity")}</option>
            {catalog.entities.map((en) => (
              <option key={en.name} value={en.name}>
                {en.label}
              </option>
            ))}
          </Select>
          <Input value={action.field ?? ""} onChange={(e) => set({ field: e.target.value })} placeholder={t("auto.cfg.field")} className="h-8 text-xs" />
          <Input value={action.value ?? ""} onChange={(e) => set({ value: e.target.value })} placeholder={t("auto.cfg.value")} className="h-8 text-xs" />
        </div>
      );
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
          <Select value={action.model ?? "lead-propensity"} onChange={(e) => set({ model: e.target.value })} className="h-8 text-xs">
            <option value="lead-propensity">{t("auto.cfg.model.leadProp")}</option>
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
            draggable
            onDragStart={() => setDragIndex(i)}
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragIndex !== null && dragIndex !== i) move(dragIndex, i);
              setDragIndex(null);
            }}
            className={cn(
              "rounded-xl border border-border bg-surface p-2.5 shadow-sm backdrop-blur-sm transition-all",
              dragIndex === i && "opacity-50",
            )}
          >
            <div className="flex items-center gap-2">
              <span className="cursor-grab text-muted-2" title="Drag to reorder">
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
  const [requiresApproval, setRequiresApproval] = useState(rule?.requiresApproval ?? false);
  const [busy, setBusy] = useState(false);

  const entity = catalog.entities.find((e) => e.name === trigger.entity);

  async function save(activate: boolean) {
    if (!name.trim()) {
      toast.error(t("auto.toast.nameRequired"));
      return;
    }
    setBusy(true);
    try {
      const payload = { name, description, trigger, conditions, actions, requiresApproval };
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

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
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
                <Select value={trigger.schedule ?? "daily"} onChange={(e) => setTrigger({ ...trigger, schedule: e.target.value })} className="text-xs">
                  <option value="hourly">Hourly</option>
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                </Select>
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

          {/* Governance + versions */}
          <div className="rounded-xl border border-border p-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={requiresApproval} onChange={(e) => setRequiresApproval(e.target.checked)} className="h-4 w-4 rounded border-border accent-primary" />
              <Icon name="shield" className="h-3.5 w-3.5 text-muted" />
              {t("auto.requireApproval")}
            </label>
            {rule && rule.versions.length > 1 && (
              <div className="mt-3">
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
    </div>
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
  const { t } = useI18n();
  return (
    <div className="glass glass-sheen rounded-2xl p-3.5 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary/15 to-secondary/10 text-primary ring-1 ring-primary/15">
          <Icon name={icon} className="h-4 w-4" />
        </span>
        <div>
          <p className="text-sm font-semibold tracking-tight">
            <span className="text-muted-2">{t("auto.step")} {step} · </span>
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
      <span className="h-5 w-px bg-gradient-to-b from-primary/40 to-secondary/40" />
    </div>
  );
}
