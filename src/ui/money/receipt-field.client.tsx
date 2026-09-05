"use client";

import { AttachmentField } from "@/ui/attachments/attachment-field.client";
import { useFormFieldValue } from "@/ui/forms/form-fields.client";

export function ReceiptField({ initialPath }: { initialPath?: string | null }) {
  return (
    <AttachmentField
      name="receiptPath"
      label="Receipt"
      purpose="receipts"
      initialPath={useFormFieldValue("receiptPath", initialPath ?? "")}
    />
  );
}
