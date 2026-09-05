import { notFound } from "next/navigation";
import { FormPage } from "@/ui/forms/form-page";
import { AppShell } from "@/ui/shell/app-shell";
import { StarterFixture } from "./starter-fixture.client";

export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    <AppShell>
      <FormPage
        title="A useful starting point"
        description="Copenhagen together"
        backHref="/plan/trips"
      >
        <StarterFixture />
      </FormPage>
    </AppShell>
  );
}
