import { notFound } from "next/navigation";
import { AppShell } from "@/ui/shell/app-shell";
export default function Page() {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  return (
    <AppShell>
      <h1>Fixture record list</h1>
    </AppShell>
  );
}
