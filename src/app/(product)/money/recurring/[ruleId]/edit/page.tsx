import { notFound } from "next/navigation";
import { requireMemberContext } from "@/lib/auth/member-context";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { loadRecurringRules } from "@/lib/read-models/money-recurring";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { RecurringForm } from "@/ui/money/recurring-form";
export default async function EditRecurringExpensePage({
  params,
}: {
  params: Promise<{ ruleId: string }>;
}) {
  const [query, member, options, rules] = await Promise.all([
    params,
    requireMemberContext(),
    loadMoneyFormOptions(),
    loadRecurringRules(),
  ]);
  const rule = rules.find((row) => row.id === query.ruleId);
  if (!rule) notFound();
  return (
    <FormPage
      backHref="/money/recurring"
      title="Edit recurring expense"
      description="Update future drafts. Saving preserves this rule's active or paused state."
    >
      <RecurringForm
        rule={rule}
        members={options.members}
        categories={options.categories}
        today={zurichCivilDate()}
        viewerId={member.userId}
      />
    </FormPage>
  );
}
