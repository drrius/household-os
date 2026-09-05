import { notFound, redirect } from "next/navigation";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { FormPage } from "@/ui/forms/form-page";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import { FormFields } from "@/ui/forms/form-fields.client";
import { AppShell } from "@/ui/shell/app-shell";

async function fixtureAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const rejected = await settleFormAction(previous, formData, async () => {
    if (formData.get("control") === "redirect")
      redirect("/m7-fixture/form-shell?destination=sign-in");
    if (formData.get("control") === "missing") notFound();
    throw new Error("Fixture could not save. Your input is safe.");
  });
  return rejected ?? previous;
}

export default async function FormShellFixture({
  searchParams,
}: {
  searchParams: Promise<{ control?: string; destination?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { control = "error", destination } = await searchParams;
  return (
    <AppShell>
      <FormPage
        title={
          destination === "sign-in"
            ? "Sign-in destination"
            : "Form and shell fixture"
        }
        description="Check shared form navigation and keyboard access."
        backHref="/m7-fixture/form-shell"
        backLabel={control === "detail" ? "Back to Home" : undefined}
      >
        <FormFields action={fixtureAction} submitLabel="Save fixture">
          <input type="hidden" name="control" value={control} />
          <label className="grid gap-2">
            Household note
            <EchoedInput
              className="rounded border p-2"
              name="note"
              initialValue="Keep this note"
            />
          </label>
        </FormFields>
        <div className="min-h-[120vh] pt-8">
          <a href="#fixture-footer">Go to page end</a>
        </div>
        <p id="fixture-footer">End of fixture</p>
      </FormPage>
    </AppShell>
  );
}
