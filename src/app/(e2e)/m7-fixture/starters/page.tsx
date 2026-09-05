import { notFound } from "next/navigation";
import { starterTaskIds } from "@/lib/projects/starter-identities";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";
import { StarterFixture } from "./starter-fixture.client";

export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const ids = starterTaskIds("22000200-0000-4000-8000-000000000001", "trip");
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
