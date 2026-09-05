"use server";
import { withSearchReturn } from "@/lib/search/save-return";
import { requireMemberContext } from "@/lib/auth/member-context";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { safeRecordReturn } from "@/lib/home-records/config";
import { isRecordKind } from "@/domain/home-records/schema";
import {
  settleFormAction,
  type FormActionState,
} from "@/lib/forms/action-state";
import {
  archiveRecord,
  chooseOption,
  convertDecision,
  saveRecord,
  setDecisionStatus,
} from "@/lib/home-records/commands";

export async function recordAction(
  previous: FormActionState,
  form: FormData,
): Promise<FormActionState> {
  await requireMemberContext();
  const kind = form.get("kind");
  const section =
    kind === "options"
      ? "decisions"
      : kind === "maintenance" || kind === "routines"
        ? "inventory"
        : kind;
  const fallback = isRecordKind(kind) ? `/home/${section}` : "/home";
  let target = safeRecordReturn(String(form.get("returnTo") ?? ""), fallback);
  const rejected = await settleFormAction(previous, form, async () => {
    if (!isRecordKind(kind)) throw new Error("Unknown record type.");
    const intent = form.get("intent") ?? "save";
    const id = String(form.get("id") ?? "");
    if (intent === "save") {
      const saved = await saveRecord(kind, form);
      if (!["maintenance", "options", "routines"].includes(kind))
        target = `/home/${kind}/${saved}?back=${encodeURIComponent(target)}`;
    } else if (intent === "archive" || intent === "restore")
      await archiveRecord(
        kind,
        id,
        String(form.get("version") ?? ""),
        intent === "restore",
      );
    else if (kind === "decisions" && intent === "choose")
      await chooseOption(id, String(form.get("optionId") ?? "") || null);
    else if (kind === "decisions" && intent === "status")
      await setDecisionStatus(id, String(form.get("status")));
    else if (kind === "decisions" && intent === "convert") {
      const project = await convertDecision(
        id,
        String(form.get("projectKind")),
      );
      target = `/plan/projects/${project}`;
    } else throw new Error("Unknown change.");
  });
  if (rejected) return rejected;
  revalidatePath("/home", "layout");
  revalidatePath("/plan");
  redirect(
    withSearchReturn(
      `${target}${target.includes("?") ? "&" : "?"}saved=1`,
      form,
    ),
  );
}
