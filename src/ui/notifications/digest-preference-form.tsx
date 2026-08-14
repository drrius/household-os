import { saveDigestPreferenceAction } from "@/app/(product)/_actions/notifications";
import type { DigestPreferenceView } from "@/lib/read-models/notifications";
import { CheckboxField } from "@/ui/forms/checkbox-field.client";
import { EchoedInput } from "@/ui/forms/echoed-control.client";
import {
  FormField,
  FormFields,
  FormSection,
} from "@/ui/forms/form-page";

type DigestPreferenceFormProps = {
  preference: DigestPreferenceView;
};

export function DigestPreferenceForm({
  preference,
}: DigestPreferenceFormProps) {
  return (
    <FormSection legend="Daily digest">
      <FormFields
        action={saveDigestPreferenceAction}
        submitLabel="Save digest"
      >
        <CheckboxField
          defaultChecked={preference.enabled}
          label="Send a calm morning digest when there is something to do"
          name="enabled"
        />
        <FormField
          description="Local time in Europe/Zurich."
          label="Digest time"
        >
          <EchoedInput
            initialValue={preference.localTime}
            name="localTime"
            required
            type="time"
          />
        </FormField>
      </FormFields>
    </FormSection>
  );
}
