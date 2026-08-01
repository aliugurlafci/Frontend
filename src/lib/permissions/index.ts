/** Phase 6 — Permission engine barrel. */
export * from "./types";
export { PermissionEngine, permissionEngine } from "./engine";
export { ROLES, grantsFor, canManageAny } from "./policies";
export { settingsAccess, type SettingsAccess } from "./settings-access";
export { DecisionCache } from "./cache";
