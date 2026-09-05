import { z } from "zod";
import { costTargetSchema } from "@/domain/money/cost-target";
export const costQuerySchema = z
  .object({
    booking: z.uuid().optional(),
    beforeOn: z.iso.date().optional(),
    beforeId: z.uuid().optional(),
    saved: z.literal("1").optional(),
    association: z.literal("saved").optional(),
  })
  .refine(
    (value) => Boolean(value.beforeOn) === Boolean(value.beforeId),
    "Use a complete activity cursor.",
  );
export function parseCostRoute(params: unknown, query: unknown) {
  const route = z.object({ kind: z.string(), id: z.string() }).parse(params);
  const search = costQuerySchema.parse(query);
  return {
    target: costTargetSchema.parse({ ...route, bookingId: search.booking }),
    before:
      search.beforeOn && search.beforeId
        ? { occurred_on: search.beforeOn, id: search.beforeId }
        : undefined,
    saved: search.saved === "1",
    associationSaved: search.association === "saved",
  };
}
