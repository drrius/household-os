import "server-only";
import { z } from "zod";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";

const unsignedInteger = z.string().regex(/^(0|[1-9]\d*)$/);
const signedInteger = z.string().regex(/^-?(0|[1-9]\d*)$/);
const cursorSchema = z.object({ occurred_on: z.iso.date(), id: z.uuid() });
const costContextSchema = z.object({
  paid_cents: signedInteger,
  event_count: unsignedInteger,
  events: z
    .array(
      z.object({
        id: z.uuid(),
        type: z.enum(["expense", "replacement", "refund", "reversal"]),
        amount_cents: unsignedInteger,
        signed_cents: signedInteger,
        related_event_id: z.uuid().nullable(),
        occurred_on: z.iso.date(),
        description: z.string(),
        payer_member_id: z.uuid().nullable(),
        context_link_id: z.uuid(),
        booking_id: z.uuid().nullable(),
        inherited: z.boolean(),
      }),
    )
    .max(100),
  next_cursor: cursorSchema.nullable(),
});
export type CostContextPage = z.infer<typeof costContextSchema>;
export type CostContextKind = "project" | "asset" | "commitment";
export type CostContextCursor = z.infer<typeof cursorSchema>;

/** Keep all amounts as decimal strings until formatting with BigInt. */
export function parseCostContextPage(value: unknown): CostContextPage {
  return costContextSchema.parse(value);
}
export async function loadCostContext(
  kind: CostContextKind,
  contextId: string,
  options: {
    pageSize?: number;
    before?: CostContextCursor;
    bookingId?: string;
  } = {},
): Promise<CostContextPage> {
  await requireMemberContext();
  const db = await createClient();
  const before = options.before ? cursorSchema.parse(options.before) : null;
  const { data, error } = await db.rpc("read_household_cost_context", {
    p_context_kind: z.enum(["project", "asset", "commitment"]).parse(kind),
    p_context_id: z.uuid().parse(contextId),
    p_page_size: z
      .number()
      .int()
      .min(1)
      .max(100)
      .parse(options.pageSize ?? 30),
    p_before_on: before?.occurred_on ?? null,
    p_before_id: before?.id ?? null,
    p_booking_id: options.bookingId ? z.uuid().parse(options.bookingId) : null,
  });
  if (error)
    throw new Error("Could not load these costs. Refresh and try again.");
  return parseCostContextPage(data);
}
