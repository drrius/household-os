"use client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";
export function RoutineOccurrenceFields({
  id,
  intent,
  initialKey,
}: {
  id: string;
  intent: string;
  initialKey: string;
}) {
  const key = useFormFieldValue("idempotencyKey", initialKey);
  return (
    <>
      <input type="hidden" name="occurrenceId" value={id} />
      <input type="hidden" name="intent" value={intent} />
      <input type="hidden" name="idempotencyKey" value={key} />
    </>
  );
}
