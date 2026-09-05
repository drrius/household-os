import { notFound } from "next/navigation";
import { AssociationExpenses } from "@/ui/money/association-expenses";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";
import { RefreshConfirmation } from "./refresh.client";
import { fixtureAssociation } from "./actions";
const id = "00000000-0000-4000-8000-000000000001";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; outcome?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { mode, outcome } = await searchParams;
  if (mode === "saved")
    return (
      <main>
        <h1>Association request saved</h1>
        <p>No new payment recorded.</p>
      </main>
    );
  return (
    <AppShell>
      {mode === "confirm" || mode === "remove" ? (
        <FormPage
          title="Review expense association"
          description="Use an existing payment."
          backHref="/m7-fixture/associations"
        >
          <RefreshConfirmation
            action={fixtureAssociation.bind(null, outcome ?? "error")}
            remove={mode === "remove"}
          />
        </FormPage>
      ) : (
        <AssociationExpenses
          members={[{ user_id: id, display_name: "Alex" }]}
          target={{ kind: "project", id, bookingId: id }}
          title="Autumn holiday · Flight"
          expenses={
            mode === "empty"
              ? []
              : [
                  {
                    id,
                    description: "Zurich flight",
                    payer_member_id: id,
                    occurred_on: "2026-09-05",
                    amount_cents: 12501,
                    type: "expense",
                  },
                ]
          }
          hasMore={mode !== "empty"}
          older={false}
        />
      )}
    </AppShell>
  );
}
