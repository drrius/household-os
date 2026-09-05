import { z } from "zod";
import { allDayBounds, isTimeZone, localDateTimeToIso } from "./date-time";
import type { CalendarEventInput } from "./types";

const optionalId = z
  .union([z.uuid(), z.literal("")])
  .transform((value) => value || null);
const schema = z.object({
  title: z.string().trim().min(1, "Give this event a title.").max(200),
  start: z.string().min(1),
  end: z.string().min(1),
  timeZone: z
    .string()
    .refine(isTimeZone, "Choose a valid time zone, such as Europe/Zurich."),
  allDay: z.boolean(),
  attendance: z.enum(["both", "one", "fyi"]),
  attendingMemberId: optionalId,
  projectId: optionalId,
  location: z.string().trim().max(500),
  notes: z.string().trim().max(8000),
  repeat: z.enum(["none", "daily", "weekly", "monthly", "yearly", "keep"]),
  until: z.string(),
});
export function parseCalendarForm(
  form: Readonly<Record<string, unknown>>,
  existingRule: string | null = null,
): CalendarEventInput {
  const data = schema.parse({
    ...form,
    allDay: form.allDay === "on",
  });
  const bounds = data.allDay
    ? allDayBounds(data.start.slice(0, 10), data.end.slice(0, 10))
    : {
        startsAt: localDateTimeToIso(data.start, data.timeZone),
        endsAt: localDateTimeToIso(data.end, data.timeZone),
      };
  if (Date.parse(bounds.endsAt) < Date.parse(bounds.startsAt))
    throw new Error("The end must be after the start.");
  if (data.attendance === "one" && !data.attendingMemberId)
    throw new Error("Choose who is going.");
  let recurrenceRule =
    data.repeat === "keep"
      ? existingRule
      : data.repeat === "none"
        ? null
        : `FREQ=${data.repeat.toUpperCase()}`;
  if (recurrenceRule && data.repeat !== "keep" && data.until) {
    const until = z.iso.date().parse(data.until);
    if (until < data.start.slice(0, 10))
      throw new Error("The repeat end must be on or after the first event.");
    recurrenceRule += data.allDay
      ? `;UNTIL=${until.replaceAll("-", "")}`
      : `;UNTIL=${localDateTimeToIso(`${until}T23:59:59`, data.timeZone).replaceAll(/[-:]/g, "")}`;
  }
  return {
    title: data.title,
    ...bounds,
    timeZone: data.timeZone,
    allDay: data.allDay,
    attendance: data.attendance,
    attendingMemberId:
      data.attendance === "one" ? data.attendingMemberId : null,
    location: data.location,
    notes: data.notes,
    projectId: data.projectId,
    recurrenceRule,
  };
}
