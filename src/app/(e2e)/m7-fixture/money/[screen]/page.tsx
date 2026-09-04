import { notFound } from "next/navigation";
import { detail, members } from "@/app/(e2e)/m7-fixture/money/fixture-data";
import { fixtureMoneyAction } from "@/app/(e2e)/m7-fixture/money/fixture-actions";
import { EventDetail } from "@/ui/money/event-detail";
import { RefundForm } from "@/ui/money/refund-form";
import { RecurringForm } from "@/ui/money/recurring-form";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";

function screenContent(screen: string) {
  if (screen === "detail") return <EventDetail detail={detail} />;
  if (screen === "refund")
    return (
      <FormPage
        backHref="/m7-fixture/money/detail"
        title="Record refund"
        description="Record a refund already received by Darius. Each share is limited to what remains."
      >
        <RefundForm
          detail={detail}
          occurredOn="2026-09-05"
          action={fixtureMoneyAction}
        />
      </FormPage>
    );
  if (screen === "recurring")
    return (
      <FormPage
        backHref="/money/recurring"
        title="New recurring expense"
        description="Creates drafts for review."
      >
        <RecurringForm
          rule={null}
          members={members}
          categories={[]}
          today="2026-09-05"
          viewerId={members[0].user_id}
          action={fixtureMoneyAction}
        />
      </FormPage>
    );
  if (screen === "correction")
    return (
      <FormPage
        backHref="/m7-fixture/money/detail"
        title="Correct financial event"
        description="Reverse and replace the original expense."
      >
        <ExpenseForm
          action={fixtureMoneyAction}
          editing
          draft={{
            ...detail.event,
            receipt_path: detail.receiptPath,
            proposed_allocations: detail.remaining,
          }}
          members={members}
          categories={[]}
          occurredOn="2026-09-05"
          viewerId={members[0].user_id}
          submitLabel="Save correction"
        />
      </FormPage>
    );
  notFound();
}
export default async function MoneyFixturePage({
  params,
}: {
  params: Promise<{ screen: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return <AppShell>{screenContent((await params).screen)}</AppShell>;
}
