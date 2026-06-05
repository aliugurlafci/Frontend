import { getServerContext } from "@/lib/http/server-context";
import { permissionEngine } from "@/lib/permissions/engine";
import { CalendarView } from "@/components/crm/calendar-view";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const ctx = await getServerContext();
  // Only users who can create/update/delete calendar events get the management
  // UI; everyone with the calendar screen still sees the events read-only.
  const canManage =
    permissionEngine.can(ctx, { action: "calendarEvent:create", entity: "calendarEvent" }) &&
    permissionEngine.can(ctx, { action: "calendarEvent:update", entity: "calendarEvent" }) &&
    permissionEngine.can(ctx, { action: "calendarEvent:delete", entity: "calendarEvent" });

  return <CalendarView canManage={canManage} />;
}
