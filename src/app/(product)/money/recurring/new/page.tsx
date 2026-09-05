import { requireMemberContext } from "@/lib/auth/member-context";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { RecurringForm } from "@/ui/money/recurring-form";
export default async function NewRecurringExpensePage() {
  const [member, options] = await Promise.all([
    requireMemberContext(),
    loadMoneyFormOptions(),
  ]);
  return (
    <FormPage
      backHref="/money/recurring"
      title="New recurring expense"
      description="Choose the amount, split, and next draft date. You can pause or change this later."
    >
      <RecurringForm
        rule={null}
        members={options.members}
        categories={options.categories}
        today={zurichCivilDate()}
        viewerId={member.userId}
      />
    </FormPage>
  );
}
