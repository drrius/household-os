"use client";
import { FormFields } from "@/ui/forms/form-fields.client";
import { CheckboxField } from "@/ui/forms/checkbox-field.client";
import { formRejection } from "@/lib/forms/action-state";
import { echoValues } from "@/lib/forms/echo";

export default function CheckboxRecoveryFixture() {
  return (
    <main className="p-6">
      <h1>Restore category</h1>
      <FormFields
        submitLabel="Save category"
        action={async (previous, form) =>
          formRejection(
            previous,
            new Error("The category changed. Try again."),
            echoValues(form),
          )
        }
      >
        <CheckboxField
          defaultChecked
          name="archive"
          label="Keep category archived"
        />
      </FormFields>
    </main>
  );
}
