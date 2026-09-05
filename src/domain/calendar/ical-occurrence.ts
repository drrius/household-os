import {
  createOccurrenceResolver,
  pointException,
} from "./ical-exception-details";
import ICAL from "ical.js";

function requestedTime(event: ICAL.Event, recurrenceId: string): ICAL.Time {
  if (!event.isRecurring()) throw new Error("This is not a repeating event.");
  let requested: ICAL.Time;
  try {
    if (recurrenceId.length > 32) throw new Error();
    requested = ICAL.Time.fromString(recurrenceId, undefined);
    if (
      requested.toString() !== recurrenceId ||
      requested.isDate !== event.startDate.isDate
    )
      throw new Error();
  } catch {
    throw new Error("Choose an existing occurrence of this series.");
  }
  if (!requested.isDate && requested.zone.tzid === "floating")
    requested.zone = event.startDate.zone;
  return requested;
}

export function resolveRecurrence(event: ICAL.Event, recurrenceId: string) {
  const requested = requestedTime(event, recurrenceId);
  const iterator = event.iterator();
  for (let count = 0; count < 50000; count++) {
    const time = iterator.next();
    if (!time || time.compare(requested) > 0)
      throw new Error(
        "This occurrence is outside the saved series or has been excluded.",
      );
    if (
      time.toString() === recurrenceId ||
      time.convertToZone(ICAL.Timezone.utcTimezone).toString() === recurrenceId
    )
      return { time, iterator };
  }
  throw new Error(
    "This series is too large to verify safely. Manage it in Apple Calendar.",
  );
}
export const findPointException = pointException;

function makeException(
  event: ICAL.Event,
  time: ICAL.Time,
  range = false,
): ICAL.Component {
  const details = createOccurrenceResolver(event)(time);
  const component = new ICAL.Component(
    JSON.parse(JSON.stringify(details.item.component.toJSON())),
  );
  for (const name of ["rrule", "rdate", "exdate", "recurrence-id"])
    component.removeAllProperties(name);
  const property = new ICAL.Property("recurrence-id");
  property.setValue(time.clone());
  if (!time.isDate && !["UTC", "floating"].includes(time.zone.tzid))
    property.setParameter("tzid", time.zone.tzid);
  if (range) property.setParameter("range", "THISANDFUTURE");
  component.addProperty(property);
  const instance = new ICAL.Event(component);
  instance.startDate = details.startDate.clone();
  instance.endDate = details.endDate.clone();
  return component;
}
/** Keep the inherited future schedule while turning its boundary into a point cancellation. */
function continueRange(
  calendar: ICAL.Component,
  event: ICAL.Event,
  iterator: ReturnType<ICAL.Event["iterator"]>,
) {
  for (let count = 0; count < 1001; count++) {
    const next = iterator.next();
    if (!next) return;
    const existing = findPointException(calendar, next);
    if (
      existing?.getFirstProperty("recurrence-id")?.getParameter("range") ===
      "THISANDFUTURE"
    )
      return;
    if (existing) continue;
    calendar.addSubcomponent(makeException(event, next, true));
    return;
  }
  throw new Error(
    "This series has too many changed dates to cancel safely here. Use Apple Calendar.",
  );
}
export function occurrenceComponent(
  calendar: ICAL.Component,
  event: ICAL.Event,
  recurrenceId: string,
  cancelled: boolean,
): ICAL.Component {
  const { time, iterator } = resolveRecurrence(event, recurrenceId);
  const existing = findPointException(calendar, time);
  if (existing) {
    const property = existing.getFirstProperty("recurrence-id");
    if (cancelled && property?.getParameter("range") === "THISANDFUTURE") {
      continueRange(calendar, event, iterator);
      property.removeParameter("range");
    }
    return existing;
  }
  const component = makeException(event, time);
  calendar.addSubcomponent(component);
  return component;
}

/** Validate exception identities with one bounded iterator, even for dense imported series. */
export function validateRecurrences(
  event: ICAL.Event,
  identities: string[],
): void {
  if (!identities.length) return;
  const requested = identities.map((id) => requestedTime(event, id));
  const last = requested.reduce((a, b) => (a.compare(b) > 0 ? a : b));
  const remaining = new Set(identities),
    iterator = event.iterator();
  for (let count = 0; count < 50000; count++) {
    const time = iterator.next();
    if (!time || time.compare(last) > 0)
      throw new Error(
        "An exception is outside the saved series or has been excluded.",
      );
    remaining.delete(time.toString());
    remaining.delete(time.convertToZone(ICAL.Timezone.utcTimezone).toString());
    if (!remaining.size) return;
  }
  throw new Error(
    "This series is too large to verify safely. Manage it in Apple Calendar.",
  );
}
