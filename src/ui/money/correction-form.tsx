import { FormField, FormFields } from "@/ui/forms/form-page";
import { EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { OpeningBalanceSummary } from "@/ui/money/opening-balance-summary.client";
import { formatCentimesField } from "@/domain/money/chf";
import type { FormAction } from "@/lib/forms/action-state";
import { MoneyCommandForm } from "@/ui/money/command-form.client";
import { correctEventAction } from "@/app/(product)/_actions/money";
import type { MoneyEventDetail } from "@/lib/read-models/money-event";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormSection } from "@/ui/forms/form-page";

function OpeningCorrectionFields({
  detail,
  action,
}: {
  detail: MoneyEventDetail;
  action: FormAction;
}) {
  const { event } = detail;
  return (
    <FormFields action={action} submitLabel="Save opening balance correction">
      <input type="hidden" name="eventId" value={event.id} />
      <input type="hidden" name="correctionMode" value="opening" />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      {detail.isReversed ? (
        <p>
          This starting balance was reversed. Record the corrected starting
          amount; the existing reversal stays in place.
        </p>
      ) : null}
      <OpeningBalanceSummary
        defaultDate={event.occurred_on}
        defaultAmount={formatCentimesField(event.amount_cents)}
        defaultCreditorId={event.payer_member_id ?? undefined}
        members={detail.members.map((member) => ({
          id: member.user_id,
          displayName: member.display_name,
        }))}
      />
      <FormField label="Note" optional>
        <EchoedTextarea
          initialValue={event.note ?? ""}
          name="note"
          maxLength={4000}
        />
      </FormField>
    </FormFields>
  );
}

export function CorrectionForm({
  detail,
  categories,
  action = correctEventAction,
}: {
  detail: MoneyEventDetail;
  action?: FormAction;
  categories: readonly { id: string; name: string }[];
}) {
  const { event } = detail;
  return (
    <div className="grid gap-8">
      {detail.canCorrectOpening ? (
        <OpeningCorrectionFields detail={detail} action={action} />
      ) : null}
      {event.type === "expense" || event.type === "replacement" ? (
        <ExpenseForm
          action={action}
          categories={categories}
          draft={{
            ...event,
            proposed_allocations: detail.allocations.map((row) => ({
              memberId: row.member_id,
              allocatedCents: row.allocated_cents,
            })),
          }}
          editing
          members={detail.members}
          occurredOn={event.occurred_on}
          viewerId={detail.viewerId}
          submitLabel="Save correction"
        >
          <input type="hidden" name="eventId" value={event.id} />
          <input type="hidden" name="correctionMode" value="replace" />
        </ExpenseForm>
      ) : null}
      {!detail.isReversed ? (
        <FormSection legend="Reverse this event">
          <p className="mb-4 text-sm text-muted-foreground">
            Cancel its effect on your balance. The original event and its
            reversal both remain in your history. No money is moved.
          </p>
          <MoneyCommandForm
            action={action}
            label="Record reversal"
            idempotencyKey={crypto.randomUUID()}
            fields={{ eventId: event.id, correctionMode: "reverse" }}
          />
        </FormSection>
      ) : null}
    </div>
  );
}
