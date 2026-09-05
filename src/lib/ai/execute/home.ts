import "server-only";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { recordKinds } from "@/domain/home-records/schema";
import { formatCentimesField } from "@/domain/money/chf";
import { requireMemberContext } from "@/lib/auth/member-context";
import {
  archiveRecord,
  chooseOption,
  convertDecision,
  saveRecord,
  setDecisionStatus,
} from "@/lib/home-records/commands";
import {
  homeFields,
  homeActionSchemas as schemas,
} from "../definitions/home-tools";
import { recordIdentity } from "../definitions/project-tools";
import { commandForm, invocationRecordId } from "./connected-input";
import type { AiWriteHandler } from "./types";
function refresh() {
  revalidatePath("/home", "layout");
  revalidatePath("/plan", "layout");
  revalidatePath("/");
}
const saveHandlers: Record<string, AiWriteHandler> = Object.fromEntries(
  recordKinds.map((kind) => [
    `save_home_${kind}`,
    async (input: unknown, context: Parameters<AiWriteHandler>[1]) => {
      const value = z
        .object({ identity: recordIdentity, fields: homeFields[kind] })
        .parse(input);
      const member = await requireMemberContext();
      const identity = value.identity;
      const id =
        identity.mode === "create"
          ? invocationRecordId(
              `${member.householdId}:${context.idempotencyKey}`,
            )
          : identity.id;
      const fields = Object.fromEntries(
        Object.entries(value.fields).map(([key, value]) => [
          key,
          key.endsWith("_amount_cents") && typeof value === "number"
            ? formatCentimesField(value)
            : value,
        ]),
      );
      const result = await saveRecord(
        kind,
        commandForm({
          ...fields,
          id,
          version: identity.mode === "update" ? identity.updatedAt : null,
        }),
      );
      refresh();
      return { id: result, kind };
    },
  ]),
);
export const HOME_HANDLERS: Record<string, AiWriteHandler> = {
  ...saveHandlers,
  archive_home_record: async (input) => {
    const value = schemas.archive_home_record.parse(input);
    await archiveRecord(value.kind, value.id, value.updatedAt, !value.archived);
    refresh();
    return { id: value.id };
  },
  choose_decision_option: async (input) => {
    const value = schemas.choose_decision_option.parse(input);
    await chooseOption(value.decisionId, value.optionId);
    refresh();
    return { id: value.decisionId };
  },
  set_decision_status: async (input) => {
    const value = schemas.set_decision_status.parse(input);
    await setDecisionStatus(value.decisionId, value.status);
    refresh();
    return { id: value.decisionId };
  },
  convert_decision_to_plan: async (input) => {
    const value = schemas.convert_decision_to_plan.parse(input);
    const projectId = await convertDecision(value.decisionId, value.kind);
    refresh();
    return { projectId };
  },
};
