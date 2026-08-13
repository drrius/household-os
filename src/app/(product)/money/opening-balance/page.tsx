import Link from "next/link";

import { establishOpeningBalanceAction } from "@/app/(product)/_actions/m7-money";
import { Textarea } from "@/components/ui/textarea";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormField, FormFields, FormPage } from "@/ui/forms/form-page";
import { OpeningBalanceSummary } from "@/ui/money/opening-balance-summary.client";

export default async function OpeningBalancePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const [options, query] = await Promise.all([
    loadMoneyFormOptions(),
    searchParams,
  ]);
  return (
    <FormPage
      backHref="/money"
      description="Record who was owed money before Household OS started. It sets the starting point for every balance after it."
      error={query.error}
      title="Opening balance"
    >
      {options.hasOpeningBalance ? (
        <p>
          This household already has an opening balance. Review it in{" "}
          <Link href="/money">Money</Link>.
        </p>
      ) : (
        <FormFields
          action={establishOpeningBalanceAction}
          submitLabel="Establish balance"
        >
          <input
            name="idempotencyKey"
            type="hidden"
            value={crypto.randomUUID()}
          />
          <OpeningBalanceSummary
            defaultDate={zurichCivilDate()}
            members={options.members.map((member) => ({
              displayName: member.display_name,
              id: member.user_id,
            }))}
          />
          <FormField label="Note" optional>
            <Textarea maxLength={4000} name="note" />
          </FormField>
          <p className="text-sm text-muted-foreground">
            This is written once and cannot be edited or removed afterwards. A
            mistake has to be corrected with a later entry that cancels it.
          </p>
        </FormFields>
      )}
    </FormPage>
  );
}
