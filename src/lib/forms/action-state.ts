import { unstable_rethrow } from "next/navigation";
import { z } from "zod";

import { echoValues } from "@/lib/forms/echo";
import { errorField } from "@/lib/forms/field-error";

export type FormActionState = {
  error?: string;
  field?: string;
  values?: Readonly<Record<string, string>>;
  submissionId: number;
};

export const initialFormActionState: FormActionState = { submissionId: 0 };

export function nextSubmissionId(previous: FormActionState): number {
  return previous.submissionId + 1;
}

export type FormAction = (
  previous: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;

export function formErrorMessage(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues[0]?.message ?? "Check the form and try again.";
  }
  if (error instanceof Error && !/failed:/i.test(error.message)) {
    return error.message;
  }
  return "We couldn't save that change. Check the details and try again.";
}

export function formRejection(
  previous: FormActionState,
  failure: unknown,
  values: Readonly<Record<string, string>>,
): FormActionState {
  return {
    error: formErrorMessage(failure),
    field: errorField(failure),
    values,
    submissionId: nextSubmissionId(previous),
  };
}

/** Returns a rejection, or `null` so `redirect()` can stay outside the `try`. */
export async function settleFormAction(
  previous: FormActionState,
  formData: FormData,
  work: () => Promise<void>,
): Promise<FormActionState | null> {
  try {
    await work();
  } catch (failure) {
    unstable_rethrow(failure);
    return formRejection(previous, failure, echoValues(formData));
  }
  return null;
}
