import { z } from "zod";

export function parseOccurrenceAction(formData: FormData) {
  return z
    .object({
      occurrenceId: z.string().uuid(),
      intent: z.enum(["complete", "skip", "reschedule"]),
      idempotencyKey: z.string().uuid(),
      photoPath: z.string().optional(),
      note: z.string().trim().max(2000).optional(),
      newDueDate: z.iso.date().optional(),
    })
    .parse({
      occurrenceId: formData.get("occurrenceId"),
      intent: formData.get("intent"),
      idempotencyKey: formData.get("idempotencyKey"),
      photoPath: formData.get("photoPath") ?? undefined,
      note: formData.get("note") ?? undefined,
      newDueDate: formData.get("newDueDate") ?? undefined,
    });
}
