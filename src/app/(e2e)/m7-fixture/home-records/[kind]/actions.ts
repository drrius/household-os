"use server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import {
  matchesRecordCreation,
  recordCreationConflict,
} from "@/domain/home-records/create-retry";
import { isRecordKind, parseRecord } from "@/domain/home-records/schema";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
export async function fixtureRecordAction(
  uncertain: boolean,
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const kind = form.get("kind");
  if (!isRecordKind(kind)) notFound();
  const jar = await cookies();
  const existing = JSON.parse(jar.get(`home-records-${kind}`)?.value ?? "{}");
  const rejected = await settleFormAction(previous, form, async () => {
    const intent = form.get("intent") ?? "save";
    const record =
      intent === "save"
        ? {
            ...parseRecord(kind, Object.fromEntries(form)),
            id: form.get("id"),
            updated_at: "2026-09-05T12:00:00Z",
            archived_at: null,
            ...(kind === "decisions" ? { status: "considering" } : {}),
            ...(kind === "options" ? { chosen: false } : {}),
          }
        : {
            ...existing,
            archived_at: intent === "archive" ? "2026-09-05" : null,
          };
    if (
      intent === "save" &&
      !form.get("version") &&
      existing.id === record.id
    ) {
      if (
        !matchesRecordCreation(
          kind,
          parseRecord(kind, Object.fromEntries(form)),
          existing,
        )
      )
        throw new Error(recordCreationConflict);
      return;
    }
    jar.set(`home-records-${kind}`, JSON.stringify(record), {
      httpOnly: true,
      sameSite: "lax",
      path: "/m7-fixture/home-records",
    });
    if (uncertain && intent === "save" && !existing.id)
      throw new Error(
        "The connection was interrupted after submission. Retry to check whether it saved.",
      );
  });
  if (rejected) return rejected;
  redirect(`/m7-fixture/home-records/${kind}?saved=1`);
}
