"use client";

import { EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField } from "@/ui/forms/form-field.client";

export function RoutineCompletionNote() {
  return (
    <FormField label="Note for your partner" optional>
      <EchoedTextarea
        name="note"
        maxLength={2000}
        placeholder="Anything worth knowing for next time…"
      />
    </FormField>
  );
}
