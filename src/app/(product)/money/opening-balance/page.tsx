import Link from "next/link";

import { establishOpeningBalanceAction } from "@/app/(product)/_actions/m7-money";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import {
  FormField,
  FormFields,
  FormPage,
  selectClassName,
} from "@/ui/forms/form-page";

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
      description="Record who was owed money before Household OS started; this creates one immutable opening event."
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
          <FormField label="Member who is owed">
            <select className={selectClassName} name="creditorMemberId">
              {options.members.map((member) => (
                <option key={member.user_id} value={member.user_id}>
                  {member.display_name}
                </option>
              ))}
            </select>
          </FormField>
          <FormField label="Amount in CHF">
            <Input
              inputMode="decimal"
              name="amount"
              placeholder="0.00"
              required
            />
          </FormField>
          <FormField label="As of">
            <Input
              defaultValue={zurichCivilDate()}
              name="occurredOn"
              required
              type="date"
            />
          </FormField>
          <FormField label="Note">
            <Textarea maxLength={4000} name="note" />
          </FormField>
        </FormFields>
      )}
    </FormPage>
  );
}
