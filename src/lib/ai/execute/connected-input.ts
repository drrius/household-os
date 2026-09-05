import "server-only";
import { createHash } from "node:crypto";

export function invocationRecordId(key: string): string {
  const bytes = createHash("sha256").update(key).digest().subarray(0, 16);
  bytes[6] = (bytes[6]! & 15) | 80;
  bytes[8] = (bytes[8]! & 63) | 128;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
export function commandForm(
  fields: Record<string, string | number | boolean | null | undefined>,
): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields))
    form.set(key, value == null ? "" : String(value));
  return form;
}
