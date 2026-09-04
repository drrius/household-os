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
  members: readonly { user_id: string; display_name: string }[];
  areas: readonly { id: string; name: string }[];
  action?: FormAction;
};
function PrepSchedule({ prep, members }: Pick<Props, "prep" | "members">) {
  if (prep.status !== "open")
    return (
      <>
        <input type="hidden" name="dueOn" value={prep.due_date} />
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
export function MealPreparationEdit({
  entryId,
  prep,
  members,
  areas,
  action = updateMealPreparationAction,
}: Props) {
  return (
    <FormFields action={action} submitLabel="Save prep task">
      <input type="hidden" name="entryId" value={entryId} />
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
