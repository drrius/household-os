"use client";
import { useState } from "react";
import { updateMealPreparationAction } from "@/app/(product)/plan/meals/[entryId]/prep/edit/actions";
import type { FormAction } from "@/lib/forms/action-state";
import type { MealPreparation } from "@/lib/meals/preparation";
import { DateField } from "@/ui/forms/date-field.client";
import { EchoedInput, EchoedTextarea } from "@/ui/forms/echoed-control.client";
import { FormField, FormFields } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";

type Props = {
  entryId: string;
  prep: MealPreparation;
  idempotencyKey: string;
  members: readonly { user_id: string; display_name: string }[];
  areas: readonly { id: string; name: string }[];
  action?: FormAction;
};
function PrepSchedule({ prep, members }: Pick<Props, "prep" | "members">) {
  if (prep.status !== "open")
    return (
      <>
        <input type="hidden" name="dueOn" value={prep.due_date} />
        <input
          type="hidden"
          name="assignedMemberId"
          value={prep.planned_assignee_id ?? ""}
        />
        <p className="text-sm text-muted-foreground">
          This task is {prep.status}. Its date and assignee are part of its
          history. You can still update the title and instructions.
        </p>
      </>
    );
  return (
    <>
      <DateField
        name="dueOn"
        label="Do it on"
        defaultValue={prep.due_date}
        required
      />
      <FormField label="Who’s doing it?">
        <EchoedSelect
          name="assignedMemberId"
          initialValue={prep.planned_assignee_id ?? ""}
          items={[
            { value: "", label: "Either of us" },
            ...members.map((member) => ({
              value: member.user_id,
              label: member.display_name,
            })),
          ]}
        />
      </FormField>
    </>
  );
}
export function MealPreparationEdit(props: Props) {
  return (
    <PreparationEditSnapshot
      key={`${props.entryId}:${props.prep.routine_id}`}
      {...props}
    />
  );
}
function PreparationEditSnapshot({
  entryId,
  prep: incomingPrep,
  idempotencyKey: incomingKey,
  members,
  areas,
  action = updateMealPreparationAction,
}: Props) {
  const [{ prep, idempotencyKey }] = useState(() => ({
    prep: incomingPrep,
    idempotencyKey: incomingKey,
  }));
  return (
    <FormFields protectChanges action={action} submitLabel="Save prep task">
      <input type="hidden" name="entryId" value={entryId} />
      <input
        type="hidden"
        name="expectedUpdatedAt"
        value={prep.routine.updated_at}
      />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <input type="hidden" name="originalDueOn" value={prep.due_date} />
      <FormField label="What needs doing?">
        <EchoedInput
          name="title"
          initialValue={prep.routine.title}
          maxLength={120}
          required
        />
      </FormField>
      <PrepSchedule prep={prep} members={members} />
      <FormField label="Area">
        <EchoedSelect
          name="areaId"
          initialValue={prep.routine.area_id}
          items={areas.map((area) => ({ value: area.id, label: area.name }))}
        />
      </FormField>
      <FormField label="Instructions" optional>
        <EchoedTextarea
          name="instructions"
          initialValue={prep.routine.instructions ?? ""}
          maxLength={4000}
        />
      </FormField>
    </FormFields>
  );
}
