import { redirect } from "next/navigation";

import { loadManageMealEntry } from "@/lib/read-models/meal-entry-manage";
import { FormPage } from "@/ui/forms/form-page";
import { ManageMealForms } from "@/ui/plan/manage-meal-forms";

export default async function ManageMealPage({
  params,
  searchParams,
}: {
  params: Promise<{ entryId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { entryId } = await params;
  const query = await searchParams;
  const entry = await loadManageMealEntry(entryId);
  if (entry === null) {
    redirect("/plan");
  }

  return (
    <FormPage
      backHref="/plan"
      description="Edit this planned meal, or remove it from the week."
      error={query.error}
      title={entry.title}
    >
      <ManageMealForms entry={entry} />
    </FormPage>
  );
}
