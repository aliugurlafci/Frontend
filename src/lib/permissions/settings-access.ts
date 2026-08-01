/**
 * Settings-screen access for the signed-in principal.
 *
 * The Settings screen is gated on two levels: the coarse `settings` screen key
 * (may this position open /settings at all?) and — here — the fine-grained
 * `settings.<area>:<action>` grants an admin ticks in the permission matrix.
 * Server components resolve one of these and gate their sections with it.
 */
import { canAnySettings, canSettings, SETTINGS_AREAS } from "@/lib/config/settings-permissions";
import type { RequestContext } from "@/lib/context/types";
import { grantsFor } from "./policies";

export interface SettingsAccess {
  /** May the principal perform `action` on the area (e.g. "settings.users", "create")? */
  can(area: string, action: string): boolean;
  /** May the principal see the area at all (any of its actions)? */
  canArea(area: string): boolean;
  /** Every area the principal may open — for the Settings hub's section list. */
  readableAreas(): string[];
}

/**
 * Effective grants: the position's matrix when it carries one (authoritative,
 * from /auth/me), else the base role's defaults — the same precedence the
 * permission engine uses.
 */
export function settingsAccess(ctx: RequestContext): SettingsAccess {
  const grants = ctx.grants?.length ? [...ctx.grants] : [...grantsFor(ctx.roles)];
  return {
    can: (area, action) => canSettings(grants, area, action),
    canArea: (area) => canAnySettings(grants, area),
    readableAreas: () => SETTINGS_AREAS.filter((a) => canSettings(grants, a.key, "read")).map((a) => a.key),
  };
}
