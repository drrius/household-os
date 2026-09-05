import { notFound } from "next/navigation";
import { projectStarters } from "@/domain/projects/starters";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";
import { StarterFixture } from "./starter-fixture.client";

export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const ids = Object.fromEntries(
    projectStarters.flatMap((starter) =>
      starter.tasks.map(([key]) => [
        `${starter.key}:${key}`,
        crypto.randomUUID(),
      ]),
    ),
  );
  return (
    <AppShell>
      <FormPage
        title="A useful starting point"
        description="Copenhagen together"
        backHref="/plan/trips"
      >
        <StarterFixture ids={ids} />
      </FormPage>
    </AppShell>
  );
}
