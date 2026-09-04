"use server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { isRecordKind, parseRecord } from "@/domain/home-records/schema";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
export async function fixtureRecordAction(
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
          }
        : {
            ...existing,
            archived_at: intent === "archive" ? "2026-09-05" : null,
          };
    jar.set(`home-records-${kind}`, JSON.stringify(record), {
      httpOnly: true,
      sameSite: "lax",
      path: "/m7-fixture/home-records",
    });
  });
  if (rejected) return rejected;
  redirect(`/m7-fixture/home-records/${kind}?saved=1`);
}
