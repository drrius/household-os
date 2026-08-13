import { notFound } from "next/navigation";

import { ExpenseForm } from "@/ui/forms/expense-form";
import { FormPage } from "@/ui/forms/form-page";
import { RoutineForm } from "@/ui/forms/routine-form";
import { AppShell } from "@/ui/shell/app-shell";

const members = [
  { user_id: "00000000-0000-4000-8000-000000000001", display_name: "Darius" },
  { user_id: "00000000-0000-4000-8000-000000000002", display_name: "Partner" },
] as const;

async function noFormAction(formData: FormData): Promise<void> {
  "use server";
  void formData;
}

function renderFlow(flow: string) {
  if (flow === "routine") {
    return (
      <FormPage
        backHref="/home"
        description="Create one-off or recurring household work with an explicit responsibility policy."
        title="New routine"
      >
        <RoutineForm
          action={noFormAction}
          areas={[{ id: "area-fixture", name: "Dog" }]}
          defaultDate="2026-08-12"
          members={members}
          pets={[{ id: "pet-fixture", name: "Jodie" }]}
          submitLabel="Create routine"
        />
      </FormPage>
    );
  }
  if (flow === "expense") {
    return (
      <FormPage
        backHref="/money"
        description="Record something one of you already paid for. We'll split it and update who owes who straight away."
        title="New expense"
      >
        <ExpenseForm
          action={noFormAction}
          categories={[{ id: "category-fixture", name: "Groceries" }]}
          draft={null}
          members={members}
          occurredOn="2026-08-12"
          viewerId={members[0].user_id}
        />
      </FormPage>
    );
  }
  notFound();
}

export default async function M7FixturePage({
  params,
}: {
  params: Promise<{ flow: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { flow } = await params;
  return <AppShell>{renderFlow(flow)}</AppShell>;
}
