import { CorrectionForm } from "@/ui/money/correction-form";
import { notFound } from "next/navigation";
import {
  detail,
  members,
  openingDetail,
  excessRefundDetail,
} from "@/app/(e2e)/m7-fixture/money/fixture-data";
import { fixtureMoneyAction } from "@/app/(e2e)/m7-fixture/money/fixture-actions";
import { EventDetail } from "@/ui/money/event-detail";
import { RefundForm } from "@/ui/money/refund-form";
import { RecurringForm } from "@/ui/money/recurring-form";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";

function screenContent(screen: string) {
  if (screen === "opening-detail")
    return <EventDetail detail={openingDetail} />;
  if (screen === "opening-reversed")
    return <EventDetail detail={{ ...openingDetail, isReversed: true }} />;
  if (screen === "legacy-refund")
    return <EventDetail detail={excessRefundDetail} />;
  if (screen === "opening-correction" || screen === "opening-repair")
    return (
      <FormPage
        backHref="/m7-fixture/money/opening-detail"
        title="Correct opening balance"
        description="Keep an accurate starting point and the full correction history."
      >
        <CorrectionForm
          detail={{ ...openingDetail, isReversed: screen === "opening-repair" }}
          categories={[]}
          action={fixtureMoneyAction}
        />
      </FormPage>
    );
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
