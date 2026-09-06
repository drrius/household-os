import { appleCalendarUrl, calendarObjectUrl } from "./apple-url";
import { CalendarError } from "./errors";
import type { CaldavTransport } from "./transport";
import { array, davText, parseMultistatus, record } from "./xml";

function textShape(value: unknown): string {
  if (value === undefined) return "missing";
  if (davText(value).trim()) return "text";
  return typeof value === "string" ? "empty" : "structured";
}

const prefix = '<?xml version="1.0" encoding="utf-8"?>';
export type AppleCalendar = { url: string; name: string; readOnly: boolean };
export type RemoteCalendarObject = { href: string; etag: string; ical: string };
async function propfind(
  transport: CaldavTransport,
  url: string,
  properties: string,
  depth: "0" | "1" = "0",
) {
  const response = await transport({
    url,
    method: "PROPFIND",
    headers: { Depth: depth },
    body: `${prefix}<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop>${properties}</d:prop></d:propfind>`,
  });
  if (response.status !== 207)
    throw new CalendarError(
      "permission",
      "iCloud did not allow calendar discovery for this account.",
    );
  return { url: response.url, resources: parseMultistatus(response.body) };
}
function findHref(
  resources: ReturnType<typeof parseMultistatus>,
  property: string,
): string {
  for (const resource of resources) {
    const href = davText(record(resource.properties[property]).href).trim();
    if (href) return href;
  }
  throw new CalendarError(
    "permission",
    "iCloud did not expose a calendar home for this account.",
  );
}
export async function discoverAppleCalendars(
  transport: CaldavTransport,
): Promise<AppleCalendar[]> {
  const principal = await propfind(
    transport,
    "https://caldav.icloud.com/",
    "<d:current-user-principal/>",
  );
  const principalUrl = appleCalendarUrl(
    findHref(principal.resources, "current-user-principal"),
    principal.url,
  ).href;
  const home = await propfind(
    transport,
    principalUrl,
    "<c:calendar-home-set/>",
  );
  const homeUrl = appleCalendarUrl(
    findHref(home.resources, "calendar-home-set"),
    home.url,
  ).href;
  const listing = await propfind(
    transport,
    homeUrl,
    "<d:displayname/><d:resourcetype/><d:current-user-privilege-set/><c:supported-calendar-component-set/>",
    "1",
  );
  return listing.resources.flatMap((resource) => {
    if (!("calendar" in record(resource.properties.resourcetype))) return [];
    const components = array(
      record(resource.properties["supported-calendar-component-set"]).comp,
    ).map((item) => record(item)["@_name"]);
    if (components.length && !components.includes("VEVENT")) return [];
    const privileges = array(
      record(resource.properties["current-user-privilege-set"]).privilege,
    ).map(record);
    const writable = privileges.some(
      (privilege) =>
        "write" in privilege ||
        "write-content" in privilege ||
        "all" in privilege,
    );
    return [
      {
        url: appleCalendarUrl(resource.href, listing.url).href,
        name:
          davText(resource.properties.displayname).trim() || "iCloud calendar",
        readOnly: !writable,
      },
    ];
  });
}
export async function readAppleCalendar(
  transport: CaldavTransport,
  calendarUrl: string,
): Promise<RemoteCalendarObject[]> {
  const response = await transport({
    url: appleCalendarUrl(calendarUrl).href,
    method: "REPORT",
    headers: { Depth: "1" },
    body: `${prefix}<c:calendar-query xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav"><d:prop><d:getetag/><c:calendar-data/></d:prop><c:filter><c:comp-filter name="VCALENDAR"><c:comp-filter name="VEVENT"/></c:comp-filter></c:filter></c:calendar-query>`,
  });
  if (response.status !== 207)
    throw new CalendarError(
      "network",
      "iCloud could not list the selected calendar. Try again.",
    );
  return parseMultistatus(response.body).map((resource) => {
    const etag = davText(resource.properties.getetag).trim();
    const ical = davText(resource.properties["calendar-data"]);
    if (resource.status !== 200 || !etag || !ical) {
      // Only fixed labels and numeric statuses: never include URLs or event data.
      const details = [
        `S${resource.status}`,
        `P${[...new Set(resource.propertyStatuses)].sort().join("-") || "none"}`,
        `E${textShape(resource.properties.getetag)}`,
        `D${textShape(resource.properties["calendar-data"])}`,
        `C${resource.href.endsWith("/") ? 1 : 0}`,
      ].join("/");
      throw new CalendarError(
        "invalid",
        `iCloud returned an incomplete event listing. No missing events were removed. Diagnostic: ${details}.`,
      );
    }
    return {
      href: calendarObjectUrl(resource.href, calendarUrl).href,
      etag,
      ical,
    };
  });
}
export async function writeAppleEvent(
  transport: CaldavTransport,
  input: {
    calendarUrl: string;
    href: string;
    etag: string | null;
    ical: string;
  },
): Promise<string> {
  const url = calendarObjectUrl(input.href, input.calendarUrl).href;
  const response = await transport({
    url,
    calendarUrl: input.calendarUrl,
    method: "PUT",
    headers: input.etag ? { "If-Match": input.etag } : { "If-None-Match": "*" },
    body: input.ical,
  });
  if (response.status === 412)
    throw new CalendarError(
      "conflict",
      "This event changed in Apple Calendar. Sync and choose which version to keep.",
    );
  if (![200, 201, 204].includes(response.status))
    throw new CalendarError(
      "permission",
      "iCloud could not save this event. Check that the calendar is editable.",
    );
  if (response.etag) return response.etag;
  const refreshed = await transport({
    url,
    calendarUrl: input.calendarUrl,
    method: "GET",
  });
  if (
    refreshed.status !== 200 ||
    !refreshed.etag ||
    refreshed.body !== input.ical
  )
    throw new CalendarError(
      "conflict",
      "iCloud saved the event but its latest version needs another sync.",
    );
  return refreshed.etag;
}
export async function deleteAppleEvent(
  transport: CaldavTransport,
  input: { calendarUrl: string; href: string; etag: string },
): Promise<void> {
  const response = await transport({
    url: calendarObjectUrl(input.href, input.calendarUrl).href,
    calendarUrl: input.calendarUrl,
    method: "DELETE",
    headers: { "If-Match": input.etag },
  });
  if (response.status === 412)
    throw new CalendarError(
      "conflict",
      "This event changed in Apple Calendar. Sync before cancelling it.",
    );
  if (![200, 204, 404, 410].includes(response.status))
    throw new CalendarError(
      "permission",
      "iCloud could not cancel this event.",
    );
}
