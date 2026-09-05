"use client";

import { useState, type ReactNode } from "react";
import type { FormAction } from "@/lib/forms/action-state";
import { FormFields } from "@/ui/forms/form-fields.client";
import { ReadyMoneyForm } from "@/ui/money/ready-form.client";

export function RefundSession({
  initialKey,
  eventId,
  action,
  children,
}: {
  initialKey: string;
  eventId: string;
  action: FormAction;
  children: ReactNode;
}) {
  const [idempotencyKey] = useState(initialKey);
  return (
    <ReadyMoneyForm>
      <FormFields action={action} submitLabel="Record refund">
        <input name="idempotencyKey" type="hidden" value={idempotencyKey} />
        <input name="eventId" type="hidden" value={eventId} />
        {children}
      </FormFields>
    </ReadyMoneyForm>
  );
}
