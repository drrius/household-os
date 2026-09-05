import "server-only";
import { revalidatePath } from "next/cache";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  saveCalendarEvent,
  cancelCalendarEvent,
  resolveCalendarConflict,
} from "@/lib/calendar/commands";
import {
  selectAppleCalendar,
  disconnectAppleCalendar,
} from "@/lib/calendar/connection";
import { syncAppleCalendar } from "@/lib/calendar/sync";
import { calendarToolSchemas as schemas } from "../definitions/calendar-tools";
import { commandForm, invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
function refresh() {
  for (const path of ["/", "/plan/calendar", "/home/calendar"])
    revalidatePath(path);
}
export const CALENDAR_HANDLERS: Record<string, AiWriteHandler> = {
  save_calendar_event: async (input, context) => {
    const value = schemas.save_calendar_event.parse(input);
    const member = await requireMemberContext();
    const identity = value.identity;
    if (identity.mode === "create" && value.recurrenceId)
      throw new Error(
        "Choose an existing recurring event before editing an occurrence.",
      );
    const form = commandForm({
      ...value.fields,
      id: identity.mode === "update" ? identity.id : "",
      version: identity.mode === "update" ? identity.updatedAt : "",
      recurrenceId: value.recurrenceId,
      allDay: value.fields.allDay ? "on" : "",
      publish: value.fields.publish ? "on" : "",
    });
    const id = await saveCalendarEvent(
      form,
      identity.mode === "create"
        ? invocationRecordId(`${member.householdId}:${context.idempotencyKey}`)
        : undefined,
    );
    refresh();
    return { id };
  },
  cancel_calendar_event: async (input) => {
    const value = schemas.cancel_calendar_event.parse(input);
    await cancelCalendarEvent(
      commandForm({ ...value, version: value.updatedAt }),
    );
    refresh();
    return { id: value.id };
  },
  resolve_calendar_conflict: async (input) => {
    const value = schemas.resolve_calendar_conflict.parse(input);
    await resolveCalendarConflict(
      commandForm({ ...value, version: value.updatedAt }),
    );
    refresh();
    return { id: value.id };
  },
  select_icloud_calendar: async (input) => {
    const value = schemas.select_icloud_calendar.parse(input);
    await selectAppleCalendar(commandForm(value));
    refresh();
    return { done: true };
  },
  sync_icloud_calendar: async () => {
    await syncAppleCalendar();
    refresh();
    return { done: true };
  },
  disconnect_icloud_calendar: async () => {
    await disconnectAppleCalendar();
    refresh();
    return { done: true };
  },
};
