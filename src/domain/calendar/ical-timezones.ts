import ICAL from "ical.js";
import { tzlib_get_ical_block } from "timezones-ical-library";

export function ensureCalendarTimezones(calendar: ICAL.Component): void {
  const defined = new Set(
    calendar
      .getAllSubcomponents("vtimezone")
      .map((zone) => String(zone.getFirstPropertyValue("tzid"))),
  );
  for (const event of calendar.getAllSubcomponents("vevent")) {
    for (const property of event.getAllProperties()) {
      const tzid = property.getParameter("tzid");
      if (typeof tzid !== "string" || defined.has(tzid)) continue;
      let block;
      try {
        const canonical = new Intl.DateTimeFormat("en", {
          timeZone: tzid,
        }).resolvedOptions().timeZone;
        block = tzlib_get_ical_block(canonical);
      } catch {
        throw new Error(
          "This time zone cannot be exported safely. Manage the event in Apple Calendar.",
        );
      }
      if (!Array.isArray(block) || !block[0])
        throw new Error(
          "This time zone cannot be exported safely. Manage the event in Apple Calendar.",
        );
      const zone = ICAL.Component.fromString(block[0]);
      // Aliases must match the actual TZID references in this resource.
      zone.updatePropertyWithValue("tzid", tzid);
      calendar.addSubcomponent(zone);
      defined.add(tzid);
    }
  }
}
