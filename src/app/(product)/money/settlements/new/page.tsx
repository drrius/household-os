import Link from "next/link";

import { recordSettlementAction } from "@/app/(product)/_actions/m7-money";
import { EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { loadSettlementContext } from "@/lib/forms/options";
import { formatCentimesAsFrancs } from "@/lib/ui/franc-display";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { DateField } from "@/ui/forms/date-field.client";
import { FormField, FormFields, FormPage } from "@/ui/forms/form-page";
import { SettlementFields } from "@/ui/forms/settlement-fields.client";
import { Amount } from "@/ui/layout/amount";

export default async function NewSettlementPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string }>;
}) {
  const [query, settlement] = await Promise.all([
    searchParams,
    loadSettlementContext(),
  ]);
  const mode = query.mode === "partial" ? "partial" : "full";
  return (
    <FormPage
      backHref="/money"
      description="Record a transfer one of you already made; Household OS never moves money itself."
      title="Record settlement"
    >
      {settlement === null ? (
        <p>
          You are already settled up, so there is nothing to record. Review the
          balance in <Link href="/money">Money</Link>.
        </p>
      ) : (
        <>
          {/* The screen this form was reached from states the balance; a
              confirmation step must not show less than it. */}
          <div className="mb-6 grid gap-1 border-b border-border pb-6">
            <p className="font-heading text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
              Right now
            </p>
            <p className="font-heading text-xl font-semibold">
              {settlement.debtorName} pays {settlement.creditorName}
            </p>
            <p className="text-3xl leading-tight font-extrabold">
              <Amount
                value={formatCentimesAsFrancs(settlement.outstandingCents)}
              />
            </p>
          </div>
          <FormFields
            action={recordSettlementAction}
            submitLabel="Record settlement"
          >
            <input
              name="idempotencyKey"
              type="hidden"
              value={crypto.randomUUID()}
            />
            <SettlementFields
              initialMode={mode}
              outstandingCents={settlement.outstandingCents}
            />
            <DateField
              defaultValue={zurichCivilDate()}
              label="Date"
              name="occurredOn"
              required
            />
            <FormField label="Note" optional>
              <EchoedTextarea maxLength={4000} name="note" />
            </FormField>
          </FormFields>
        </>
      )}
    </FormPage>
  );
}
