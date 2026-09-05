import { z } from "zod";
import { parseChfToCentimesOrNull } from "@/domain/money/chf";
import { validRecordDate } from "@/domain/home-records/dates";

export const recordKinds = [
  "inventory",
  "contacts",
  "commitments",
  "decisions",
  "documents",
  "maintenance",
  "options",
  "routines",
] as const;
export type RecordKind = (typeof recordKinds)[number];
export type HomeRecord = {
  id: string;
  updated_at?: string;
  archived_at?: string | null;
  [key: string]: string | number | boolean | null | undefined;
};
const text = (max = 8000) => z.string().trim().max(max).default("");
const title = (max = 160) =>
  z.string().trim().min(1, "Enter a name or title.").max(max);
const uuid = z.string().uuid("Choose an available record.");
const optionalId = z
  .union([uuid, z.literal(""), z.null()])
  .default("")
  .transform((v) => v || null);
const date = z.string().refine(validRecordDate, "Enter a valid date.");
const optionalDate = z
  .union([date, z.literal(""), z.null()])
  .default("")
  .transform((v) => v || null);
const website = text(2000).refine(
  (v) => !v || (/^https?:\/\//i.test(v) && z.url().safeParse(v).success),
  "Use a full http or https address.",
);
const amount = text(30).transform((v, ctx) => {
  if (!v) return null;
  const cents = parseChfToCentimesOrNull(v);
  if (cents === null)
    ctx.addIssue({
      code: "custom",
      message: "Enter a CHF amount with up to two decimal places.",
    });
  return cents;
});
const schemas = {
  inventory: z
    .object({
      title: title(),
      category: text(80),
      model: text(200),
      serial_number: text(200),
      purchased_on: optionalDate,
      warranty_until: optionalDate,
      contact_id: optionalId,
      notes: text(),
    })
    .refine(
      (v) =>
        !v.purchased_on ||
        !v.warranty_until ||
        v.warranty_until >= v.purchased_on,
      {
        message: "Warranty must end on or after purchase.",
        path: ["warranty_until"],
      },
    ),
  contacts: z.object({
    name: title(),
    company: text(200),
    phone: text(80),
    email: text(254).refine(
      (v) => !v || z.email().safeParse(v).success,
      "Enter a valid email address.",
    ),
    website,
    notes: text(4000),
  }),
  commitments: z.object({
    title: title(),
    provider: text(200),
    status: z.enum(["active", "cancel_requested", "ended"]),
    responsible_member_id: optionalId,
    renewal_on: optionalDate,
    notice_days: z.coerce.number().int().min(0).max(730),
    expected_amount_cents: amount,
    billing_interval: z.enum(["weekly", "monthly", "yearly", "one_off"]),
    recurring_expense_rule_id: optionalId,
    contact_id: optionalId,
    website,
    notes: text(),
  }),
  decisions: z.object({
    title: title(200),
    notes: text(),
    project_id: optionalId,
  }),
  documents: z
    .object({
      title: title(200),
      file_path: z.string().trim().min(1, "Upload a file first.").max(2000),
      asset_id: optionalId,
      commitment_id: optionalId,
      project_id: optionalId,
      booking_id: optionalId,
    })
    .refine(
      (v) =>
        [v.asset_id, v.commitment_id, v.project_id].filter(Boolean).length <= 1,
      { message: "Link the document to one home record.", path: ["asset_id"] },
    )
    .refine((v) => !v.booking_id || Boolean(v.project_id), {
      message: "Choose the trip for this booking.",
      path: ["project_id"],
    }),
  maintenance: z.object({
    asset_id: uuid,
    title: title(200),
    performed_on: date,
    routine_id: optionalId,
    notes: text(4000),
  }),
  options: z.object({
    decision_id: uuid,
    title: title(200),
    website,
    estimated_amount_cents: amount,
    notes: text(4000),
  }),
  routines: z.object({ asset_id: uuid, routine_id: uuid }),
};
export function parseRecord(kind: RecordKind, input: Record<string, unknown>) {
  return schemas[kind].parse(input);
}
export function isRecordKind(value: unknown): value is RecordKind {
  return recordKinds.some((kind) => kind === value);
}
