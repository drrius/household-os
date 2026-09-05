import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { formRejection, type FormActionState } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";
import { FormPage } from "@/ui/forms/form-page";
import { FormFields } from "@/ui/forms/form-fields.client";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import { EchoedSelect } from "@/ui/forms/form-select.client";
import { ExpenseForm } from "@/ui/forms/expense-form";
import { RoutineForm } from "@/ui/forms/routine-form";
import { AppShell } from "@/ui/shell/app-shell";
import { DiscardFixtureControls } from "./controls.client";

async function save(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  await new Promise((resolve) => setTimeout(resolve, 250));
  if (form.get("note") === "reject")
    return formRejection(
      previous,
      new Error("Fixture save failed. Your values are preserved."),
      echoValues(form),
    );
  if (form.get("outcome") === "redirect")
    redirect("/m7-fixture/discard?destination=saved");
  return { submissionId: previous.submissionId + 1 };
}
const members = [
  { user_id: "a", display_name: "Alex" },
  { user_id: "b", display_name: "Robin" },
];
function BasicForm({ kind, outcome }: { kind?: string; outcome?: string }) {
  return (
    <FormFields
      action={save}
      protectChanges={kind !== "tiny"}
      submitLabel="Save fixture"
    >
      <input type="hidden" name="outcome" value={outcome ?? "return"} />
      <input type="hidden" name="idempotencyKey" value={crypto.randomUUID()} />
      <label>
        Note
        <EchoedInput name="note" initialValue="Original note" />
      </label>
      <label>
        Area
        <EchoedSelect
          name="area"
          initialValue="home"
          items={[
            { value: "home", label: "Home" },
            { value: "garden", label: "Garden" },
          ]}
        />
      </label>
      <DiscardFixtureControls seed={crypto.randomUUID()} />
    </FormFields>
  );
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    kind?: string;
    destination?: string;
    outcome?: string;
  }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { kind, destination, outcome } = await searchParams;
  if (destination)
    return (
      <main>
        <h1>
          {destination === "saved" ? "Saved fixture" : "Discard destination"}
        </h1>
      </main>
    );
  return (
    <AppShell>
      <FormPage
        title="Discard fixture"
        description="Verify meaningful form changes and recovery."
        backHref="/m7-fixture/discard?destination=cancelled"
      >
        {kind === "expense" ? (
          <ExpenseForm
            action={save}
            categories={[]}
            draft={null}
            members={members}
            occurredOn="2026-09-05"
            viewerId="a"
          />
        ) : kind === "routine" ? (
          <RoutineForm
            action={save}
            areas={[{ id: "home", name: "Home" }]}
            defaultDate="2026-09-05"
            members={members}
            pets={[]}
            submitLabel="Save routine"
          />
        ) : (
          <BasicForm kind={kind} outcome={outcome} />
        )}
        <Link href="/m7-fixture/discard?destination=navigation">
          Another page
        </Link>
        <a href="#details">Jump to details</a>
        <p id="details">Details inside this form page</p>
      </FormPage>
    </AppShell>
  );
}
