import { connection } from "next/server";
import { notFound } from "next/navigation";
import { ContextCosts } from "@/ui/money/context-costs";
import { ContextExpenseForm } from "@/ui/money/context-expense-form.client";
import { AppShell } from "@/ui/shell/app-shell";
import { FormPage } from "@/ui/forms/form-page";
import { fixtureCostExpense } from "./actions";
const id = "00000000-0000-4000-8000-000000000001";
const eventId = "00000000-0000-4000-8000-000000000003";
const members = [
  { user_id: "00000000-0000-4000-8000-000000000011", display_name: "Alex" },
  { user_id: "00000000-0000-4000-8000-000000000012", display_name: "Sam" },
];
export default async function ContextCostFixture({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; saved?: string }>;
}) {
  await connection();
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const query = await searchParams;
  const archived = query.mode === "archived";
  const empty = query.mode === "empty";
  return (
    <AppShell>
      {query.mode === "form" ? (
        <FormPage
          backHref="/m7-fixture/context-costs"
          title="Add paid expense"
          description="For our September trip. This paid expense updates who owes whom."
        >
          <ContextExpenseForm
            action={fixtureCostExpense}
            initialKey={id}
            members={members}
            categories={[]}
            occurredOn="2026-09-05"
            viewerId={members[0]!.user_id}
          />
        </FormPage>
      ) : (
        <ContextCosts
          target={{ kind: "project", id }}
          record={{
            id,
            title: "Our September trip",
            archived_at: archived ? "2026-09-01" : null,
          }}
          booking={null}
          costs={{
            paid_cents: empty ? "0" : "18014398509481982",
            event_count: empty ? "0" : "3",
            events: empty
              ? []
              : [
                  {
                    id: eventId,
                    type: "expense",
                    amount_cents: "12501",
                    signed_cents: "12501",
                    related_event_id: null,
                    occurred_on: "2026-09-05",
                    description: "Hotel deposit",
                    payer_member_id: members[0]!.user_id,
                    context_link_id: id,
                    booking_id: "00000000-0000-4000-8000-000000000002",
                    inherited: false,
                  },
                  {
                    id: "00000000-0000-4000-8000-000000000004",
                    type: "refund",
                    amount_cents: "2500",
                    signed_cents: "-2500",
                    related_event_id: eventId,
                    occurred_on: "2026-09-04",
                    description: "Hotel refund",
                    payer_member_id: members[0]!.user_id,
                    context_link_id: id,
                    booking_id: null,
                    inherited: true,
                  },
                ],
            next_cursor: empty
              ? null
              : { id: eventId, occurred_on: "2026-09-04" },
          }}
          members={members}
          saved={query.saved === "1"}
        />
      )}
    </AppShell>
  );
}
