"use client";

import { useEditSnapshot } from "./use-edit-snapshot.client";
import type { ProjectMember, ProjectTask } from "@/domain/projects/types";
import type { FormAction } from "@/lib/forms/action-state";
import { FormFields } from "@/ui/forms/form-fields.client";
import { RecordField, RecordSelect } from "@/ui/projects/record-field.client";

type TaskFormProps = {
  id: string;
  projectId: string;
  task?: ProjectTask;
  members: ProjectMember[];
  action: FormAction;
};

export function ProjectTaskForm(props: TaskFormProps) {
  return <TaskEditor key={props.task?.id ?? props.id} {...props} />;
}

function TaskEditor(props: TaskFormProps) {
  const task = props.task;
  const { data, events } = useEditSnapshot(
    props,
    {
      title: task?.title ?? "",
      assigned_member_id: task?.assigned_member_id ?? "",
      due_on: task?.due_on ?? "",
      section: task?.section ?? "Tasks",
      notes: task?.notes ?? "",
    },
    !task,
  );
  return (
    <div {...events}>
      <TaskFields
        key={data.task?.updated_at ?? "new"}
        {...data}
        action={props.action}
      />
    </div>
  );
}

function TaskFields({ id, projectId, task, members, action }: TaskFormProps) {
  return (
    <FormFields
      protectChanges
      action={action}
      submitLabel={task ? "Save task" : "Add task"}
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="project_id" value={projectId} />
      <input type="hidden" name="updatedAt" value={task?.updated_at ?? ""} />
      <RecordField
        name="title"
        label="What needs doing?"
        initial={task?.title}
        maxLength={200}
      />
      <RecordSelect
        name="assigned_member_id"
        label="Who will do it?"
        initial={task?.assigned_member_id ?? ""}
        optional
        options={[
          { value: "", label: "Either of us" },
          ...members.map((member) => ({
            value: member.user_id,
            label: member.display_name,
          })),
        ]}
      />
      <RecordField
        name="due_on"
        label="Due date"
        type="date"
        initial={task?.due_on ?? ""}
        optional
      />
      <details className="rounded-xl border p-4">
        <summary className="cursor-pointer py-1 font-medium">
          Notes and checklist
        </summary>
        <div className="mt-4 grid gap-5">
          <RecordField
            name="section"
            label="Checklist"
            initial={task?.section ?? "Tasks"}
            maxLength={80}
          />
          <RecordField
            name="notes"
            label="Notes"
            initial={task?.notes}
            multiline
            optional
            maxLength={4000}
          />
        </div>
      </details>
    </FormFields>
  );
}
