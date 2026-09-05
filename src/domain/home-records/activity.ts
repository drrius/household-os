import { z } from "zod";

const homeRecordActivitySchema = z.object({
  record_kind: z.enum([
    "contact",
    "asset",
    "commitment",
    "decision",
    "decision_option",
    "document",
    "maintenance",
  ]),
  label: z.string().trim().min(1).max(200),
  operation: z.enum(["added", "updated", "archived", "restored"]),
});
const HOME_RECORD_NAMES = {
  contact: "contact",
  asset: "item",
  commitment: "commitment",
  decision: "decision",
  decision_option: "option",
  document: "document",
  maintenance: "maintenance record",
} as const;

export function householdRecordActivity(payload: unknown): string | null {
  const parsed = homeRecordActivitySchema.safeParse(payload);
  if (!parsed.success) return null;
  const { operation, record_kind, label } = parsed.data;
  return `${operation} ${HOME_RECORD_NAMES[record_kind]}: ${label}`;
}
