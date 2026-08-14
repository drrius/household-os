/**
 * Thrown by form parsers when a rejection belongs to one named control.
 * Actions pass `errorField(failure)` through unchanged, so the message lands
 * under the field that caused it instead of only above the card.
 */
export class FormFieldError extends Error {
  readonly field: string;

  constructor(field: string, message: string) {
    super(message);
    this.field = field;
    this.name = "FormFieldError";
  }
}

export function errorField(error: unknown): string | undefined {
  return error instanceof FormFieldError ? error.field : undefined;
}
