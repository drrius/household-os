import { z } from "zod";

export const costKind = z.enum(["project", "asset", "commitment"]);
export const costTargetSchema = z
  .object({
    kind: costKind,
    id: z.uuid(),
    bookingId: z.uuid().optional(),
  })
  .refine(
    (target) => !target.bookingId || target.kind === "project",
    "Bookings belong to trips or projects.",
  );
export type CostTarget = z.infer<typeof costTargetSchema>;
export type CostRecord = {
  id: string;
  title: string;
  archived_at: string | null;
};
export const costKindLabels = {
  project: "Trips & projects",
  asset: "Inventory",
  commitment: "Commitments",
} as const;
export function costTargetHref(target: CostTarget): string {
  const value = costTargetSchema.parse(target);
  return `/money/contexts/${value.kind}/${value.id}${value.bookingId ? `?booking=${value.bookingId}` : ""}`;
}
export function costExpenseHref(target: CostTarget): string {
  const value = costTargetSchema.parse(target);
  return `/money/contexts/${value.kind}/${value.id}/new${value.bookingId ? `?booking=${value.bookingId}` : ""}`;
}
