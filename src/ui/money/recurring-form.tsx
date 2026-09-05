import {
  RecurringFormClient,
  type RecurringFormProps,
} from "./recurring-form.client";
export function RecurringForm(props: RecurringFormProps) {
  return (
    <RecurringFormClient {...props} idempotencyKey={crypto.randomUUID()} />
  );
}
