import { notFound, redirect } from "next/navigation";
import { parseOccurrenceAction } from "@/lib/forms/routine-occurrence";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { OccurrenceActions } from "@/ui/today/occurrence-actions";
import { RoutineLifecycle } from "@/ui/home/routine-lifecycle";
import { AppShell } from "@/ui/shell/app-shell";

async function fixtureAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  "use server";
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const rejected = await settleFormAction(previous, formData, async () => {
    const input = parseOccurrenceAction(formData);
    if (input.note === "retry me")
      throw new Error("Couldn't save. Your note is still here.");
  });
  if (rejected)
    return {
      ...rejected,
      values: {
        ...rejected.values,
        idempotencyKey: String(formData.get("idempotencyKey")),
      },
    };
  redirect(`/m7-fixture/routine-polish?saved=${formData.get("intent")}`);
}

export default async function RoutinePolishFixture({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const query = await searchParams;
  return (
    <AppShell>
      <div className="mx-auto grid w-full max-w-xl gap-6 p-5">
        <h1>Walk the dog</h1>
        <p>Bring water and the blue lead.</p>
        {query.saved ? <p role="status">Saved {query.saved}</p> : null}
        <OccurrenceActions
          action={fixtureAction}
          id="f0000000-0000-4000-8000-000000000001"
          dueDate="2026-09-05"
        />
        <RoutineLifecycle
          routineId="f0000000-0000-4000-8000-000000000001"
          paused={false}
        />
      </div>
    </AppShell>
  );
}
