/**
 * The mutation-result contract shared by every form screen.
 *
 * A successful action still ends in `redirect()` and therefore never returns.
 * A rejected action returns instead of redirecting, so the form stays mounted
 * with the entered values and the failure can be attached to one field.
 */
export type FormActionState = {
  error?: string;
  field?: string;
  values?: Readonly<Record<string, string>>;
  /**
   * Bumped by every rejection. Two identical failures in a row would otherwise
   * return an identical object, so the live region's effect dependencies would
   * not change and the second failure would never be announced.
   */
  submissionId: number;
};

export const initialFormActionState: FormActionState = { submissionId: 0 };

/**
 * `(previous, formData)` on purpose: this is the exact signature
 * `useActionState` expects, so `FormFields` can hand the server action to it
 * untouched.
 *
 * Wrapping a one-argument action in a client-side adapter would replace the
 * server reference with an ordinary closure, and React can only serialise a
 * server reference into the rendered `<form action>`. Without that attribute
 * the form does not reach the server until the client bundle has hydrated, so
 * submitting early — or with JavaScript disabled — does nothing.
 */
export type FormAction = (
  previous: FormActionState,
  formData: FormData,
) => Promise<FormActionState>;
