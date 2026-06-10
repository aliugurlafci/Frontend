/**
 * Automation console — client-side types.
 *
 * Mirrors the backend automation contract (`Backend/src/lib/automation/types.ts`)
 * one-to-one so the console, builder and logs render the API responses directly.
 */

export type AutomationStatus = "active" | "paused" | "draft";
export type TriggerKind = "event" | "schedule" | "inactivity" | "webhook";
export type TriggerEvent =
  | "created"
  | "updated"
  | "deleted"
  | "stage_changed"
  | "won"
  | "lost"
  | "converted"
  | "any";

export interface AutomationTrigger {
  kind: TriggerKind;
  entity?: string;
  event?: TriggerEvent;
  schedule?: string;
  /** For `schedule: "minutely"` — run every N minutes. */
  everyMinutes?: number;
  inactivityDays?: number;
  webhookEvent?: string;
}

export type ConditionOp =
  | "eq"
  | "ne"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "in"
  | "is_empty"
  | "is_not_empty"
  | "changed";

export interface ConditionLeaf {
  type: "condition";
  field: string;
  op: ConditionOp;
  value?: string | number | boolean | null;
}
export interface ConditionGroup {
  type: "group";
  logic: "AND" | "OR";
  children: Array<ConditionLeaf | ConditionGroup>;
}

export type ActionType =
  | "send_email"
  | "send_sms"
  | "send_whatsapp"
  | "notify"
  | "create_task"
  | "assign_owner"
  | "update_stage"
  | "update_record"
  | "create_record"
  | "create_reminder"
  | "webhook"
  | "delay"
  | "branch"
  | "parallel"
  | "ai_score";

export interface AutomationAction {
  id: string;
  type: ActionType;
  to?: string;
  subject?: string;
  body?: string;
  taskSubject?: string;
  assignTo?: string;
  entity?: string;
  field?: string;
  value?: string;
  /** create_record — multiple field assignments for the new record. */
  assignments?: { field: string; value: string }[];
  stage?: string;
  url?: string;
  delayMinutes?: number;
  reminderInDays?: number;
  model?: string;
  condition?: ConditionGroup;
  thenActions?: AutomationAction[];
  elseActions?: AutomationAction[];
  lanes?: AutomationAction[][];
}

export interface AutomationVersionSnapshot {
  version: number;
  at: string;
  by: string;
  note?: string;
  trigger: AutomationTrigger;
  conditions: ConditionGroup;
  actions: AutomationAction[];
}

export interface AutomationStats {
  runs: number;
  success: number;
  failure: number;
  skipped: number;
  avgMs: number;
  lastRunAt: string | null;
  impact: number;
}

export interface AutomationRule {
  id: string;
  name: string;
  description?: string;
  status: AutomationStatus;
  trigger: AutomationTrigger;
  conditions: ConditionGroup;
  actions: AutomationAction[];
  version: number;
  versions: AutomationVersionSnapshot[];
  stats: AutomationStats;
  tags: string[];
  requiresApproval: boolean;
  approvedBy: string | null;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export type RunStatus = "success" | "failed" | "skipped" | "running" | "queued";
export type StepStatus = "ok" | "failed" | "skipped";

export interface RunStep {
  name: string;
  type: string;
  status: StepStatus;
  ms: number;
  output?: string;
  error?: string;
}

export interface AutomationRun {
  id: string;
  ruleId: string;
  ruleName: string;
  status: RunStatus;
  trigger: string;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  steps: RunStep[];
  startedAt: string;
  finishedAt: string;
  durationMs: number;
  error?: string;
  test: boolean;
}

export type QueueState = "pending" | "retry" | "dead";
export interface QueueItem {
  id: string;
  ruleId: string;
  ruleName: string;
  state: QueueState;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: string | null;
  enqueuedAt: string;
  lastError?: string;
  input: Record<string, unknown>;
}

export type AssignmentStrategy = "round_robin" | "territory" | "load_based" | "manual";
export interface AssignmentRule {
  id: string;
  name: string;
  entity: string;
  strategy: AssignmentStrategy;
  pool: string[];
  territoryMap?: Record<string, string>;
  enabled: boolean;
  cursor: number;
}

export interface AutomationSettings {
  realtimeAlerts: boolean;
  failureAlerts: boolean;
  slaAlerts: boolean;
  slaMinutes: number;
  businessHoursOnly: boolean;
  businessStart: string;
  businessEnd: string;
  timezone: string;
  maxRetries: number;
  rateLimitPerMin: number;
  maxConcurrent: number;
  aiLeadScoring: boolean;
  aiNextBestAction: boolean;
  aiSmartAssignment: boolean;
  aiPredictive: boolean;
}

export interface CatalogField {
  name: string;
  label: string;
  type: string;
  options?: { value: string; label: string }[];
}
export interface CatalogEntity {
  name: string;
  label: string;
  pluralLabel: string;
  icon?: string;
  fields: CatalogField[];
  lifecycleField?: string;
  lifecycleStates?: string[];
  lifecycleActions?: { action: string; to: string }[];
}
export interface AutomationCatalog {
  entities: CatalogEntity[];
  triggerKinds: { value: string; label: string; description: string }[];
  triggerEvents: { value: string; label: string }[];
  operators: { value: string; label: string; unary?: boolean }[];
  actionTypes: { value: string; label: string; group: string; description: string }[];
  assignmentStrategies: { value: string; label: string; description: string }[];
}

export interface AutomationStatsResponse {
  active: number;
  paused: number;
  draft: number;
  total: number;
  runs: number;
  success: number;
  failure: number;
  successRate: number;
  avgMs: number;
  impact: number;
  queue: { pending: number; retry: number; dead: number };
  recentRuns: AutomationRun[];
  topRules: { id: string; name: string; runs: number; successRate: number; status: AutomationStatus }[];
}

export interface CatalogUser {
  id: string;
  displayName: string;
}

/** A live snapshot of automation activity (polled by the Automations screen). */
export interface LivePulse {
  ruleId: string;
  ruleName: string;
  status: RunStatus;
  at: string;
  durationMs: number;
  test: boolean;
}
export interface LiveActivity {
  running: string[];
  recent: LivePulse[];
}

/** Result of draining the processing queue. */
export interface QueueDrainResult {
  processed: number;
  succeeded: number;
  failed: number;
  dead: number;
  remaining: number;
}

/** Action-type → icon name + tone helpers shared across the console. */
export const ACTION_ICON: Record<ActionType, string> = {
  send_email: "email",
  send_sms: "chat",
  send_whatsapp: "chat",
  notify: "bell",
  create_task: "check",
  create_reminder: "calendar",
  assign_owner: "user",
  update_stage: "trending",
  update_record: "edit",
  create_record: "plus",
  webhook: "globe",
  delay: "recurring",
  branch: "pipeline",
  parallel: "network",
  ai_score: "activity",
};

export const TRIGGER_ICON: Record<TriggerKind, string> = {
  event: "activity",
  schedule: "calendar",
  inactivity: "recurring",
  webhook: "globe",
};

// ---- integrations -----------------------------------------------------------

export type IntegrationFieldType = "text" | "password" | "number" | "boolean" | "select";

export interface IntegrationField {
  key: string;
  label: string;
  type: IntegrationFieldType;
  placeholder?: string;
  options?: { value: string; label: string }[];
  secret?: boolean;
  help?: string;
}

export interface IntegrationProviderDef {
  key: string;
  name: string;
  category: string;
  icon: string;
  description: string;
  fields: IntegrationField[];
}

export type IntegrationConfig = Record<string, string | number | boolean>;

export interface IntegrationState {
  provider: string;
  enabled: boolean;
  config: IntegrationConfig;
}

export interface IntegrationsResponse {
  providers: IntegrationProviderDef[];
  integrations: IntegrationState[];
}

// ---- system settings --------------------------------------------------------

export interface SystemSettingValue {
  key: string;
  label: string;
  group: string;
  type: "text" | "password" | "number" | "boolean" | "select";
  options?: { value: string; label: string }[];
  secret: boolean;
  readonly: boolean;
  restart: boolean;
  help?: string;
  value: string;
  fromDb: boolean;
}

export interface SystemSettingsResponse {
  groups: string[];
  settings: SystemSettingValue[];
}

export const STATUS_TONE: Record<AutomationStatus, "success" | "warning" | "neutral"> = {
  active: "success",
  paused: "warning",
  draft: "neutral",
};

export const RUN_TONE: Record<RunStatus, "success" | "danger" | "neutral" | "info" | "warning"> = {
  success: "success",
  failed: "danger",
  skipped: "neutral",
  running: "info",
  queued: "warning",
};
