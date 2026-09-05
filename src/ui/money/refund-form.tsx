import { RefundSession } from "@/ui/money/refund-session.client";
import { refundEventAction } from "@/app/(product)/_actions/money";
import type { FormAction } from "@/lib/forms/action-state";
import type { MoneyEventDetail } from "@/lib/read-models/money-event";
import { DateField } from "@/ui/forms/date-field.client";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormSection } from "@/ui/forms/form-page";
import { RefundFields } from "@/ui/money/refund-fields.client";

export function RefundForm({
  detail,
  occurredOn,
  action = refundEventAction,
}: {
  detail: MoneyEventDetail;
  occurredOn: string;
  action?: FormAction;
}) {
  return (
    <RefundSession
      key={detail.event.id}
      initialKey={crypto.randomUUID()}
      eventId={detail.event.id}
      action={action}
    >
      <RefundFields members={detail.members} remaining={detail.remaining} />
      <FormSection legend="Details">
        <FormField label="Description">
          <EchoedInput
            name="description"
            initialValue={`Refund: ${detail.event.description}`.slice(0, 200)}
            maxLength={200}
            required
          />
        </FormField>
        <DateField
          label="Date received"
          name="occurredOn"
          defaultValue={occurredOn}
          required
        />
        <FormField label="Note" optional>
          <EchoedTextarea name="note" maxLength={4000} />
        </FormField>
      </FormSection>
    </RefundSession>
  );
}
