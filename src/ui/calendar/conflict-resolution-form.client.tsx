"use client";
import { resolveConflictAction } from "@/lib/calendar/actions";
import { FormFields, FormField } from "@/ui/forms/form-page";
import { EchoedSelect } from "@/ui/forms/form-select.client";
export function ConflictResolutionForm({
  id,
  version,
}: {
  id: string;
  version: string;
}) {
  return (
    <FormFields
      action={resolveConflictAction}
      submitLabel="Keep selected version"
    >
      <input name="id" type="hidden" value={id} />
      <input name="version" type="hidden" value={version} />
      <FormField label="Version to keep">
        <EchoedSelect
          name="choice"
          initialValue="remote"
          items={[
            { value: "remote", label: "Keep Apple Calendar version" },
            {
              value: "local",
              label: "Keep Household OS version; send on next sync",
            },
          ]}
        />
      </FormField>
    </FormFields>
  );
}
