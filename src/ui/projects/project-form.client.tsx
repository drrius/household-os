"use client";

import type { HouseholdProject, ProjectKind } from "@/domain/projects/types";
import { formatCentimesField } from "@/domain/money/chf";
import type { FormAction } from "@/lib/forms/action-state";
import { FormFields } from "@/ui/forms/form-fields.client";
import { RecordField, RecordSelect } from "@/ui/projects/record-field.client";

export function ProjectForm({
  id,
  kind,
  project,
  action,
}: {
  id: string;
  kind: ProjectKind;
  project?: HouseholdProject;
  action: FormAction;
}) {
  return (
    <FormFields
      action={action}
      submitLabel={
        project
          ? "Save changes"
          : kind === "trip"
            ? "Create trip"
            : "Create project"
      }
    >
      <input type="hidden" name="id" value={id} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="updatedAt" value={project?.updated_at ?? ""} />
      <RecordField
        name="title"
        label={kind === "trip" ? "Trip name" : "Project name"}
        initial={project?.title}
        maxLength={160}
      />
      {kind === "trip" && (
        <RecordField
          name="destination"
          label="Destination"
          initial={project?.destination}
          optional
          maxLength={300}
        />
      )}
      <div className="grid gap-5 @sm:grid-cols-2">
        <RecordField
          name="starts_on"
          label="Start date"
          type="date"
          initial={project?.starts_on ?? ""}
          optional
        />
        <RecordField
          name="ends_on"
          label="End date"
          type="date"
          initial={project?.ends_on ?? ""}
          optional
        />
      </div>
      <RecordField
        name="description"
        label="Notes"
        initial={project?.description}
        optional
        multiline
        maxLength={8000}
      />
      <ProjectBudgetStatus project={project} />
    </FormFields>
  );
}

function ProjectBudgetStatus({ project }: { project?: HouseholdProject }) {
  return (
    <details className="rounded-xl border p-4">
      <summary className="cursor-pointer py-1 font-medium">
        Budget and status
      </summary>
      <div className="mt-4 grid gap-5">
        <RecordField
          name="budget"
          label="Budget · CHF"
          initial={
            project?.budget_cents != null
              ? formatCentimesField(project.budget_cents)
              : ""
          }
          optional
          description="A planning amount. Paid expenses are recorded separately in Money."
        />
        <RecordSelect
          name="status"
          label="Status"
          initial={project?.status ?? "planning"}
          options={[
            { value: "planning", label: "Planning" },
            { value: "active", label: "In progress" },
            { value: "complete", label: "Complete" },
            { value: "cancelled", label: "Cancelled" },
          ]}
        />
      </div>
    </details>
  );
}
