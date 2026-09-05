import { isTimeZone } from "./date-time";
import { masterFromIcal } from "./ical-read";
export function storageCalendarTimeZone(timeZone: string): string {
  return isTimeZone(timeZone) ? timeZone : "UTC";
}
/** Only the relational projection is normalized; the resource's original ICS stays intact. */
export function calendarMasterForStorage(ical: string) {
  const master = masterFromIcal(ical);
  return { ...master, timeZone: storageCalendarTimeZone(master.timeZone) };
}
