import "server-only";
import { z } from "zod";
import { isHouseholdAttachment } from "@/domain/attachments/files";
import { parseRecord, type RecordKind } from "@/domain/home-records/schema";
import {
  matchesRecordCreation,
  recordCreationConflict,
} from "@/domain/home-records/create-retry";
import { requireMemberContext } from "@/lib/auth/member-context";
import { createClient } from "@/lib/supabase/server";
import { FormFieldError } from "@/lib/forms/field-error";
import { recordTables } from "./config";

function checkedPayload(kind: RecordKind, form: FormData) {
  try {
    return parseRecord(kind, Object.fromEntries(form));
  } catch (error) {
    if (error instanceof z.ZodError)
      throw new FormFieldError(
        String(error.issues[0]?.path[0] ?? "title"),
        error.issues[0]?.message ?? "Check the details.",
      );
    throw error;
  }
}
export async function saveRecord(
  kind: RecordKind,
  form: FormData,
): Promise<string> {
  const member = await requireMemberContext();
  const id = z.uuid().parse(form.get("id"));
  const values = checkedPayload(kind, form);
  if (
    "file_path" in values &&
    !isHouseholdAttachment(values.file_path, member.householdId)
  )
    throw new FormFieldError(
      "file_path",
      "Upload a file for this household first.",
    );
  const db = await createClient();
  const version = form.get("version");
  if (typeof version === "string" && version) {
    const updatedValues =
      kind === "options"
        ? Object.fromEntries(
            Object.entries(values).filter(([key]) => key !== "decision_id"),
          )
        : values;
    const { data, error } = await db
      .from(recordTables[kind])
      .update(updatedValues)
      .eq("household_id", member.householdId)
      .eq("id", id)
      .eq("updated_at", version)
      .select("id")
      .maybeSingle();
    if (error)
      throw new Error("Couldn't save. Check linked records and try again.");
    if (!data)
      throw new Error(
        "This record changed. Reload to see the latest version before saving.",
      );
  } else {
    const result = await db.from(recordTables[kind]).insert({
      ...values,
      id,
      household_id: member.householdId,
      created_by: member.userId,
    });
    if (result.error?.code === "23505") {
      const existing = await db
        .from(recordTables[kind])
        .select(
          [
            ...new Set([
              "id",
              "archived_at",
              ...Object.keys(values),
              ...(kind === "decisions" ? ["status"] : []),
              ...(kind === "options" ? ["chosen"] : []),
            ]),
          ].join(","),
        )
        .eq("household_id", member.householdId)
        .eq("id", id)
        .maybeSingle();
      if (!existing.error && existing.data) {
        if (!matchesRecordCreation(kind, values, existing.data))
          throw new Error(recordCreationConflict);
        return id;
      }
    }
    if (result.error)
      throw new Error("Couldn't save. Check linked records and try again.");
  }
  return id;
}
export async function archiveRecord(
  kind: RecordKind,
  id: string,
  version: string,
  restore: boolean,
) {
  const member = await requireMemberContext();
  z.uuid().parse(id);
  const db = await createClient();
  if (kind === "options") {
    const { error } = await db.rpc(
      "archive_household_decision_option_versioned",
      {
        p_option_id: id,
        p_archived: !restore,
        p_version: version,
      },
    );
    if (error)
      throw new Error("Couldn't change this option. Reload and try again.");
    return;
  }
  const values = { archived_at: restore ? null : new Date().toISOString() };
  const { data, error } = await db
    .from(recordTables[kind])
    .update(values)
    .eq("household_id", member.householdId)
    .eq("id", id)
    .eq("updated_at", version)
    .select("id")
    .maybeSingle();
  if (error || !data)
    throw new Error(
      "Couldn't change this record. Reload to see the latest version.",
    );
}
export async function chooseOption(
  decisionId: string,
  optionId: string | null,
) {
  await requireMemberContext();
  z.uuid().parse(decisionId);
  if (optionId) z.uuid().parse(optionId);
  const { error } = await (
    await createClient()
  ).rpc("choose_household_decision_option", {
    p_decision_id: decisionId,
    p_option_id: optionId,
  });
  if (error?.code === "55000")
    throw new Error("Restore this decision before changing its choice.");
  if (error)
    throw new Error("Couldn't update the choice. Reload and try again.");
}
export async function convertDecision(decisionId: string, kind: string) {
  await requireMemberContext();
  z.uuid().parse(decisionId);
  z.enum(["project", "trip"]).parse(kind);
  const { data, error } = await (
    await createClient()
  ).rpc("convert_household_decision", {
    p_decision_id: decisionId,
    p_kind: kind,
  });
  if (error || typeof data !== "string")
    throw new Error("Couldn't create the plan. Try again.");
  return data;
}

export async function setDecisionStatus(decisionId: string, status: string) {
  await requireMemberContext();
  z.uuid().parse(decisionId);
  z.enum(["considering", "decided", "dismissed"]).parse(status);
  const { error } = await (
    await createClient()
  ).rpc("set_household_decision_status", {
    p_decision_id: decisionId,
    p_status: status,
  });
  if (error?.code === "55000")
    throw new Error("Restore this decision before changing its status.");
  if (error) throw new Error("Couldn't update this decision. Try again.");
}
