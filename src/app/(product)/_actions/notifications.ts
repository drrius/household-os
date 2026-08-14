"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { FormFieldError } from "@/lib/forms/field-error";
import {
  markInboxNotificationsRead,
  registerPushSubscription,
  unregisterPushSubscription,
  upsertDigestPreference,
} from "@/lib/notifications/commands";

const localTimeSchema = z
  .string()
  .trim()
  .regex(/^\d{2}:\d{2}$/u, "Choose a valid time.");

export async function saveDigestPreferenceAction(
  previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const rejected = await settleFormAction(previous, formData, async () => {
    const enabledRaw = formData.get("enabled");
    const enabled = enabledRaw === "on" || enabledRaw === "true";
    const localTimeValue = formData.get("localTime");
    const parsedTime = localTimeSchema.safeParse(
      typeof localTimeValue === "string" ? localTimeValue : "",
    );
    if (!parsedTime.success) {
      throw new FormFieldError("localTime", "Choose a valid time.");
    }
    await upsertDigestPreference({
      enabled,
      localTime: parsedTime.data,
    });
  });
  if (rejected) return rejected;
  revalidatePath("/home/notifications");
  redirect("/home/notifications?saved=digest");
}

export async function registerPushSubscriptionAction(input: {
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await registerPushSubscription(input);
    revalidatePath("/home/notifications");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not save the push subscription.",
    };
  }
}

export async function unregisterPushSubscriptionAction(input: {
  endpoint: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await unregisterPushSubscription(input);
    revalidatePath("/home/notifications");
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error
          ? error.message
          : "Could not remove the push subscription.",
    };
  }
}

export async function markInboxReadFormAction(
  formData: FormData,
): Promise<void> {
  const ids = formData
    .getAll("notificationId")
    .filter((value): value is string => typeof value === "string")
    .filter((value) => value.length > 0);
  if (ids.length === 0) {
    return;
  }
  await markInboxNotificationsRead({ notificationIds: ids });
  revalidatePath("/home/inbox");
  revalidatePath("/home/notifications");
}
