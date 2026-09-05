export class CalendarError extends Error {
  constructor(
    readonly code:
      | "authentication"
      | "permission"
      | "network"
      | "conflict"
      | "invalid"
      | "size"
      | "busy",
    message: string,
  ) {
    super(message);
    this.name = "CalendarError";
  }
}
export function calendarErrorMessage(error: unknown): string {
  return error instanceof CalendarError
    ? error.message
    : "Calendar update failed. Your saved events are safe. Try again.";
}
