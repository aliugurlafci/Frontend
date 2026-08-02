import { getServerContext } from "@/lib/http/server-context";
import { permissionEngine } from "@/lib/permissions/engine";
import { serverApi } from "@/lib/http/server-api";
import { metadata } from "@/lib/metadata";
import { getLocale } from "@/lib/i18n/server";
import { entityLabel } from "@/lib/i18n/labels";
import { CalendarView, type CalendarUser, type RelatedEntityOption } from "@/components/crm/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const ctx = await getServerContext();
  // Only users who can create/update/delete calendar events get the management
  // UI; everyone with the calendar screen still sees the events read-only.
  const canManage =
    permissionEngine.can(ctx, { action: "calendarEvent:create", entity: "calendarEvent" }) &&
    permissionEngine.can(ctx, { action: "calendarEvent:update", entity: "calendarEvent" }) &&
    permissionEngine.can(ctx, { action: "calendarEvent:delete", entity: "calendarEvent" });

  // Attendee / owner pickers. Visibility rules apply server-side, so this is
  // already narrowed to the people this user may see.
  let users: CalendarUser[] = [];
  if (canManage) {
    users = await serverApi
      .list("user", { pageSize: 200, sort: [{ field: "displayName", dir: "asc" }] })
      .then((page) => page.items.map((u) => ({ id: String(u.id), name: String(u.displayName ?? u.email ?? u.id) })))
      .catch(() => []);
  }

  // Records an event may be linked to: the entities this user can read, labelled
  // in the active language.
  const locale = await getLocale();
  const relatedEntities: RelatedEntityOption[] = metadata
    .listEntities()
    .filter((e) => !e.system && permissionEngine.can(ctx, { action: `${e.name}:read`, entity: e.name }))
    .map((e) => ({ name: e.name, label: entityLabel(e, locale, { plural: false }) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale));

  return <CalendarView canManage={canManage} users={users} relatedEntities={relatedEntities} />;
}
