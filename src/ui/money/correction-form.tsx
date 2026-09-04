import { MoneyCommandForm } from "@/ui/money/command-form.client";
import { correctEventAction } from "@/app/(product)/_actions/money";
import type { MoneyEventDetail } from "@/lib/read-models/money-event";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormSection } from "@/ui/forms/form-page";

export function CorrectionForm({
  detail,
  categories,
}: {
  detail: MoneyEventDetail;
  categories: readonly { id: string; name: string }[];
}) {
  const { event } = detail;
  return (
    <div className="grid gap-8">
      {event.type === "expense" || event.type === "replacement" ? (
        <ExpenseForm
          action={correctEventAction}
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
      <FormSection legend="Reverse this event">
        <p className="mb-4 text-sm text-muted-foreground">
          Cancel its effect on your balance. The original event and its reversal
          both remain in your history. No money is moved.
        </p>
        <MoneyCommandForm
          action={correctEventAction}
          label="Record reversal"
          idempotencyKey={crypto.randomUUID()}
          fields={{ eventId: event.id, correctionMode: "reverse" }}
        />
      </FormSection>
    </div>
  );
}
