import { notFound } from "next/navigation";
import { requireMemberContext } from "@/lib/auth/member-context";
import { costTargetHref } from "@/domain/money/cost-target";
import { loadCostRecord } from "@/lib/connected/cost-records";
import { parseCostRoute } from "@/lib/connected/cost-route";
import { loadMoneyFormOptions } from "@/lib/forms/options";
import { zurichCivilDate } from "@/lib/ui/zurich-date";
import { FormPage } from "@/ui/forms/form-page";
import { ContextExpenseForm } from "@/ui/money/context-expense-form.client";
import { postContextExpenseAction } from "../../../actions";
export default async function NewContextExpense({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string; id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const args = await Promise.all([params, searchParams]);
  let route;
  try {
    route = parseCostRoute(...args);
  } catch {
    notFound();
  }
  const data = await loadCostRecord(route.target);
  if (!data || data.record.archived_at || data.booking?.archived_at) notFound();
  const [member, options] = await Promise.all([
    requireMemberContext(),
    loadMoneyFormOptions(),
  ]);
  return (
    <FormPage
      backHref={costTargetHref(route.target)}
      title="Add paid expense"
      description={`For ${data.booking?.title ?? data.record.title}. Record only something already paid. The expense updates both this record’s paid costs and who owes whom.`}
    >
      <ContextExpenseForm
        key={costTargetHref(route.target)}
        action={postContextExpenseAction.bind(null, route.target)}
        initialKey={crypto.randomUUID()}
        members={options.members}
        categories={options.categories}
        occurredOn={zurichCivilDate()}
        viewerId={member.userId}
      />
    </FormPage>
  );
}
