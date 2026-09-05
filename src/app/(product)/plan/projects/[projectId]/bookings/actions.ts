"use server";
import { bookingBack } from "@/lib/trips/navigation";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import { recordId, recordVersion } from "@/lib/projects/forms";
import { loadProject } from "@/lib/projects/queries";
import { parseBookingForm } from "@/lib/trips/forms";
import { saveBooking, archiveBooking } from "@/lib/trips/commands";
import { loadBooking } from "@/lib/trips/queries";
async function requireActiveTrip(projectId: string) {
  const project = await loadProject(projectId);
  if (!project || project.kind !== "trip" || project.archived_at)
    throw new Error("Open an active trip before changing bookings.");
}
function refresh(projectId: string) {
  revalidatePath(`/plan/projects/${projectId}`, "layout");
  revalidatePath("/plan/trips");
}
export async function saveBookingAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  await requireMemberContext();
  let projectId = "",
    id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    projectId = recordId(form.get("project_id"));
    id = recordId(form.get("id"));
    await requireActiveTrip(projectId);
    const original = recordVersion(form)
      ? await loadBooking(projectId, id)
      : null;
    if (recordVersion(form) && (!original || original.archived_at))
      throw new Error("Restore this booking before editing it.");
    await saveBooking(parseBookingForm(form, original ?? undefined));
  });
  if (rejected) return rejected;
  refresh(projectId);
  redirect(
    `/plan/projects/${projectId}/bookings/${id}?back=${encodeURIComponent(bookingBack(projectId, String(form.get("back") ?? "")))}`,
  );
}
export async function archiveBookingAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  await requireMemberContext();
  let projectId = "",
    id = "";
  const rejected = await settleFormAction(previous, form, async () => {
    projectId = recordId(form.get("project_id"));
    id = recordId(form.get("id"));
    const version = recordVersion(form);
    if (!version) throw new Error("Reload this booking before changing it.");
    await requireActiveTrip(projectId);
    if (!["true", "false"].includes(String(form.get("archived"))))
      throw new Error("Choose a valid booking action.");
    await archiveBooking(
      projectId,
      id,
      version,
      form.get("archived") === "true",
    );
  });
  if (rejected) return rejected;
  refresh(projectId);
  redirect(
    `/plan/projects/${projectId}/bookings/${id}?back=${encodeURIComponent(bookingBack(projectId, String(form.get("back") ?? "")))}`,
  );
}
