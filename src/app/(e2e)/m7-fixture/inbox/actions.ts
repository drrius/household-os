"use server";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { FormActionState } from "@/lib/forms/action-state";
import { inboxReadIds, parseInboxContext } from "@/domain/notifications/inbox";
import { fixtureInboxHref } from "./data";
export async function fixtureMarkRead(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  if (process.env.HOUSEHOLD_OS_E2E_FIXTURES !== "1") notFound();
  const context = parseInboxContext({
    filter: form.get("filter"),
    cursor: form.get("cursor"),
  });
  const ids = inboxReadIds(form.getAll("notificationId"));
  if (previous.submissionId === 0)
    return {
      submissionId: 1,
      error: "Couldn't mark these messages read. Please try again.",
    };
  const jar = await cookies();
  const previousIds = (jar.get("inbox-read")?.value ?? "")
    .split(",")
    .filter(Boolean);
  jar.set("inbox-read", [...new Set([...previousIds, ...ids])].join(","), {
    path: "/m7-fixture/inbox",
    httpOnly: true,
  });
  redirect(`${fixtureInboxHref(context)}&saved=read`);
}
