import { XMLParser, XMLValidator } from "fast-xml-parser";
import { CalendarError } from "./errors";

export function xmlEscape(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}
function xmlText(value: unknown): string {
  if (typeof value !== "string") return "";
  return value.replace(
    /&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,
    (_, entity: string) => {
      const named: Record<string, string> = {
        amp: "&",
        lt: "<",
        gt: ">",
        quot: '"',
        apos: "'",
      };
      if (entity in named) return named[entity]!;
      const code = entity.startsWith("#x")
        ? Number.parseInt(entity.slice(2), 16)
        : Number.parseInt(entity.slice(1), 10);
      if (!Number.isFinite(code) || code < 1 || code > 0x10ffff)
        throw new CalendarError("invalid", "iCloud returned invalid text.");
      return String.fromCodePoint(code);
    },
  );
}
export function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
export function array(value: unknown): unknown[] {
  return value === undefined ? [] : Array.isArray(value) ? value : [value];
}
export type DavResource = {
  href: string;
  status: number;
  properties: Record<string, unknown>;
};
export function parseMultistatus(xml: string): DavResource[] {
  if (
    xml.length > 4 * 1024 * 1024 ||
    /<!DOCTYPE|<!ENTITY/i.test(xml) ||
    XMLValidator.validate(xml) !== true
  ) {
    throw new CalendarError(
      "invalid",
      "iCloud returned an invalid calendar response. No events were changed.",
    );
  }
  const parsed = record(
    new XMLParser({
      ignoreAttributes: false,
      removeNSPrefix: true,
      processEntities: false,
      parseTagValue: false,
      trimValues: false,
    }).parse(xml),
  );
  if (!("multistatus" in parsed))
    throw new CalendarError(
      "invalid",
      "iCloud did not return a calendar listing.",
    );
  const resources = array(record(parsed.multistatus).response);
  if (resources.length > 2000)
    throw new CalendarError(
      "size",
      "This calendar has too many events for one safe sync. Choose a smaller calendar.",
    );
  return resources.map((resource) => {
    const row = record(resource);
    const properties: Record<string, unknown> = {};
    for (const propstat of array(row.propstat)) {
      const group = record(propstat);
      if (/\s200\s/.test(String(group.status)))
        Object.assign(properties, record(group.prop));
    }
    const match = /\s(\d{3})\s/.exec(String(row.status ?? "HTTP/1.1 200 OK"));
    return {
      href: xmlText(row.href).trim(),
      status: Number(match?.[1] ?? 0),
      properties,
    };
  });
}
export function davText(value: unknown): string {
  return xmlText(value);
}
