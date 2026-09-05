import { z } from "zod";
import { recordKinds } from "@/domain/home-records/schema";
import { isoDate, uuid, type AiToolDefinition } from "./schemas";
import { recordIdentity, editVersion } from "./project-tools";
const text = (max = 8000) => z.string().trim().max(max).default("");
const title = (max = 160) => z.string().trim().min(1).max(max);
const optionalId = uuid.nullable().default(null);
const date = isoDate.nullable().default(null);
const cents = z.number().int().min(0).max(2147483647).nullable().default(null);
export const homeFields = {
  inventory: z.object({
    title: title(),
    category: text(80),
    model: text(200),
    serial_number: text(200),
    purchased_on: date,
    warranty_until: date,
    contact_id: optionalId,
    notes: text(),
  }),
  contacts: z.object({
    name: title(),
    company: text(200),
    phone: text(80),
    email: text(254),
    website: text(2000),
    notes: text(4000),
  }),
  commitments: z.object({
    title: title(),
    provider: text(200),
    status: z.enum(["active", "cancel_requested", "ended"]),
    responsible_member_id: optionalId,
    renewal_on: date,
    notice_days: z.number().int().min(0).max(730),
    expected_amount_cents: cents,
    billing_interval: z.enum(["weekly", "monthly", "yearly", "one_off"]),
    recurring_expense_rule_id: optionalId,
    contact_id: optionalId,
    website: text(2000),
    notes: text(),
  }),
  decisions: z.object({
    title: title(200),
    notes: text(),
    project_id: optionalId,
  }),
  documents: z.object({
    title: title(200),
    file_path: z
      .string()
      .min(1)
      .max(2000)
      .describe(
        "An existing authorized attachment path returned by the app; never invent a path. Upload new files through the document form first.",
      ),
    asset_id: optionalId,
    commitment_id: optionalId,
    project_id: optionalId,
    booking_id: optionalId,
  }),
  maintenance: z.object({
    asset_id: uuid,
    title: title(200),
    performed_on: isoDate,
    routine_id: optionalId,
    notes: text(4000),
  }),
  options: z.object({
    decision_id: uuid,
    title: title(200),
    website: text(2000),
    estimated_amount_cents: cents,
    notes: text(4000),
  }),
  routines: z.object({ asset_id: uuid, routine_id: uuid }),
};
export const homeActionSchemas = {
  archive_home_record: z.object({
    kind: z.enum(recordKinds),
    id: uuid,
    updatedAt: editVersion,
    archived: z.boolean(),
  }),
  choose_decision_option: z.object({
    decisionId: uuid,
    optionId: uuid.nullable(),
  }),
  set_decision_status: z.object({
    decisionId: uuid,
    status: z.enum(["considering", "decided", "dismissed"]),
  }),
  convert_decision_to_plan: z.object({
    decisionId: uuid,
    kind: z.enum(["project", "trip"]),
  }),
};
export const HOME_TOOLS: readonly AiToolDefinition[] = [
  ...recordKinds.map((kind) => ({
    name: `save_home_${kind}`,
    kind: "write" as const,
    inputSchema: z.object({
      identity: recordIdentity,
      fields: homeFields[kind],
    }),
    description: `Create or replace editable ${kind} details. Read the existing record before updating, preserve unchanged fields, and supply its updated_at version. Money fields are integer CHF centime estimates, never payments. Creates use a stable invocation identity.${kind === "routines" ? " This links an existing routine to an asset, rather than creating a routine." : ""}${kind === "documents" ? " This manages metadata for a real private attachment; new uploads require a member handoff to /home/documents/new." : ""}`,
  })),
  {
    name: "archive_home_record",
    kind: "write",
    inputSchema: homeActionSchemas.archive_home_record,
    description:
      "Archive or restore a Home record using its current edit version. History and linked money are retained. Archiving a chosen decision option clears its choice atomically.",
  },
  {
    name: "choose_decision_option",
    kind: "write",
    inputSchema: homeActionSchemas.choose_decision_option,
    description:
      "Choose one existing option for a shared decision, or clear its choice with null. Read current decision/options first. Changes choice atomically; never posts money.",
  },
  {
    name: "set_decision_status",
    kind: "write",
    inputSchema: homeActionSchemas.set_decision_status,
    description:
      "Reopen, decide or dismiss a shared decision through the guarded command. Dismissing clears its choice. Read its current state first; archived decisions must be restored.",
  },
  {
    name: "convert_decision_to_plan",
    kind: "write",
    inputSchema: homeActionSchemas.convert_decision_to_plan,
    description:
      "Turn an existing shared decision into a project or trip. Repeated conversion returns the original plan; never posts an expense.",
  },
];
