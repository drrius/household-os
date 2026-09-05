import { withSearchReturn } from "@/lib/search/save-return";
import type { FormActionState } from "@/lib/forms/action-state";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { AppShell } from "@/ui/shell/app-shell";
import { FormFields } from "@/ui/forms/form-fields.client";
import { EchoedInput } from "@/ui/forms/echoed-control.client";

async function save(
  id: string,
  previous: FormActionState,
  form: FormData,
): Promise<never> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  void previous;
  const destination =
    form.get("returnList") === "yes"
      ? "/m7-fixture/search-origin"
      : `/m7-fixture/search-origin/${z.uuid().parse(id)}`;
  redirect(withSearchReturn(destination, form));
}
export default async function Page({
  params,
}: {
  params: Promise<{ id: string; screen?: string[] }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { id, screen } = await params;
  if (
    !z.uuid().safeParse(id).success ||
    (screen && screen.join("/") !== "edit")
  )
    notFound();
  const base = `/m7-fixture/search-origin/${id}`;
  return (
    <AppShell>
      <h1>{screen ? "Edit fixture record" : "Fixture record"}</h1>
      {screen ? (
        <FormFields
          protectChanges
          action={save.bind(null, id)}
          submitLabel="Save fixture record"
        >
          <label>
            Record title
            <EchoedInput name="title" initialValue="Lisbon booking" />
          </label>
          <button type="submit" name="returnList" value="yes">
            Save and return to list
          </button>
        </FormFields>
      ) : (
        <Link href={`${base}/edit`}>Edit record</Link>
      )}
      <Link href="/m7-fixture/search-origin/77000000-0000-4000-8000-000000000002">
        Open unrelated record
      </Link>
    </AppShell>
  );
}
