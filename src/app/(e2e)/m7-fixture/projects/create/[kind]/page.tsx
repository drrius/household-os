import Link from "next/link";
import { notFound } from "next/navigation";
import { requireCreationId } from "@/lib/projects/creation-id";
import { parseProjectForm, parseTaskForm } from "@/lib/projects/forms";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { ProjectForm } from "@/ui/projects/project-form.client";
import { ProjectTaskForm } from "@/ui/projects/task-form.client";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";

async function uncertainSave(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (await settleFormAction(previous, form, async () => {
    const parsed = form.has("project_id")
      ? parseTaskForm(form)
      : parseProjectForm(form);
    throw new Error(
      `Retry operation ${parsed.id}. No household was changed by this fixture.`,
    );
  }))!;
}

export default async function CreationFixture({
  params,
  searchParams,
}: {
  params: Promise<{ kind: string }>;
  searchParams: Promise<{ draft?: string | string[] }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { kind } = await params;
  if (kind !== "project" && kind !== "trip" && kind !== "task") notFound();
  const pathname = `/m7-fixture/projects/create/${kind}`;
  const id = requireCreationId((await searchParams).draft, pathname);
  return (
    <AppShell>
      <FormPage
        title={`New ${kind}`}
        description="Creation retry fixture"
        backHref="/m7-fixture/projects"
      >
        <Link href={pathname} prefetch={false}>
          Start another {kind}
        </Link>
        {kind === "task" ? (
          <ProjectTaskForm
            id={id}
            projectId="39000000-0000-4000-8000-000000000039"
            members={[]}
            action={uncertainSave}
          />
        ) : (
          <ProjectForm id={id} kind={kind} action={uncertainSave} />
        )}
      </FormPage>
    </AppShell>
  );
}
