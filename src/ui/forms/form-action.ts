/**
 * The mutation-result contract shared by every form screen.
 *
 * A successful action still ends in `redirect()` and therefore never returns.
 * A rejected action returns instead of redirecting, so the form stays mounted
 * with the entered values and the failure can be attached to one field.
 */
export type FormActionResult = void | {
  error?: string;
  field?: string;
  values?: Readonly<Record<string, string>>;
};

/**
 * Single-argument shape on purpose: every existing server action stays
 * assignable, so call sites never change. `FormFields` adapts it internally to
 * the `(previous, formData)` signature `useActionState` expects.
 */
export type FormAction = (formData: FormData) => Promise<FormActionResult>;
