import { notFound } from "next/navigation";
import { PushSetupFixture } from "./push-setup-fixture.client";
export default async function PushFixturePage({
  searchParams,
}: {
  searchParams: Promise<{ state?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const { state = "unregistered" } = await searchParams;
  return (
    <main className="mx-auto max-w-lg p-5">
      <h1 className="mb-6 text-2xl font-semibold">Push on this device</h1>
      <PushSetupFixture state={state} />
    </main>
  );
}
