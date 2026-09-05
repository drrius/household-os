"use client";

import { AttachmentField } from "@/ui/attachments/attachment-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

export function RoutinePhotoField() {
  return (
    <AttachmentField
      name="photoPath"
      label="Photo"
      purpose="completions"
      initialPath={useFormFieldValue("photoPath")}
    />
  );
}
