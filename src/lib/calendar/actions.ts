"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  saveCalendarEvent,
  cancelCalendarEvent,
  resolveCalendarConflict,
} from "./commands";
import {
  connectAppleCalendar,
  selectAppleCalendar,
  disconnectAppleCalendar,
} from "./connection";
import { syncAppleCalendar } from "./sync";
import { calendarErrorMessage } from "./errors";
function refreshCalendar() {
  revalidatePath("/plan");
  revalidatePath("/plan/calendar");
  revalidatePath("/home/calendar");
}
export async function saveEventAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const failure = await settleFormAction(previous, form, async () => {
    await saveCalendarEvent(form);
  });
  if (failure) return failure;
  refreshCalendar();
  redirect("/plan/calendar");
}
export async function cancelEventAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const failure = await settleFormAction(previous, form, async () => {
    await cancelCalendarEvent(form);
  });
  if (failure) return failure;
  refreshCalendar();
  redirect("/plan/calendar");
}
export async function resolveConflictAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const failure = await settleFormAction(previous, form, async () => {
    await resolveCalendarConflict(form);
  });
  if (failure) return failure;
  refreshCalendar();
  redirect("/plan/calendar");
}
export async function connectCalendarAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  // Passwords must never be reflected in action state or rendered back into HTML.
  try {
    await connectAppleCalendar(form);
  } catch (error) {
    return {
      submissionId: previous.submissionId + 1,
      error: calendarErrorMessage(error),
    };
  }
  refreshCalendar();
  redirect("/home/calendar");
}
export async function selectCalendarAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  const failure = await settleFormAction(previous, form, async () => {
    await selectAppleCalendar(form);
  });
  if (failure) return failure;
  refreshCalendar();
  redirect("/home/calendar");
}
export async function syncCalendarAction(
  previous: FormActionState,
): Promise<FormActionState> {
  try {
    await syncAppleCalendar();
  } catch (error) {
    refreshCalendar();
    return {
      submissionId: previous.submissionId + 1,
      error: calendarErrorMessage(error),
    };
  }
  refreshCalendar();
  return { submissionId: previous.submissionId + 1 };
}
export async function disconnectCalendarAction(
  previous: FormActionState,
): Promise<FormActionState> {
  try {
    await disconnectAppleCalendar();
  } catch (error) {
    return {
      submissionId: previous.submissionId + 1,
      error: calendarErrorMessage(error),
    };
  }
  refreshCalendar();
  redirect("/home/calendar");
}
