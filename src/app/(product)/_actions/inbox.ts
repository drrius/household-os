"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { inboxHref, parseInboxContext } from "@/domain/notifications/inbox";
import { markInboxPageRead } from "@/lib/notifications/inbox-commands";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
export async function markInboxPageReadAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  let href = "/home/inbox";
  const rejected = await settleFormAction(previous, form, async () => {
    const context = parseInboxContext({
      filter: form.get("filter"),
      cursor: form.get("cursor"),
    });
    href = inboxHref(context);
    await markInboxPageRead(form.getAll("notificationId"));
  });
  if (rejected) return rejected;
  revalidatePath("/home/inbox");
  revalidatePath("/home/notifications");
  revalidatePath("/");
  redirect(`${href}&saved=read`);
}
