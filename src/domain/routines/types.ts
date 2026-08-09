export type MemberId = string & { readonly __brand: "MemberId" };
export type RoutineId = string & { readonly __brand: "RoutineId" };
export type OccurrenceId = string & { readonly __brand: "OccurrenceId" };
export type AreaId = string & { readonly __brand: "AreaId" };
export type PetId = string & { readonly __brand: "PetId" };

/** Civil calendar date as `YYYY-MM-DD`. */
export type IsoDate = string & { readonly __brand: "IsoDate" };

/** ISO weekday: Monday = 1 … Sunday = 7. */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type ScheduleKind = "one_off" | "calendar" | "after_completion";

export type ScheduleRule =
  | { kind: "one_off"; date: IsoDate }
  | { kind: "daily" }
  | { kind: "weekdays"; days: readonly IsoWeekday[] }
  | { kind: "weekly"; weekday: IsoWeekday }
  | { kind: "monthly"; dayOfMonth: number }
  | { kind: "after_completion"; every: number; unit: "days" | "weeks" };

export type AssignmentPolicy = "assigned" | "alternating" | "shared";

export type Assignment =
  | { policy: "assigned"; memberId: MemberId }
  | { policy: "alternating"; anchorMemberId: MemberId }
  | { policy: "shared" };

export type RoutinePriority =
  | "pet_care"
  | "meal_deadline"
  | "cleaning"
  | "general";

export type OccurrenceStatus = "open" | "completed" | "skipped";

export type OccurrenceRole = "current" | "preview";

export type ClosureCommandKind = "complete" | "skip" | "reschedule";

export function asMemberId(value: string): MemberId {
  if (value.length === 0) {
    throw new Error("MemberId must be a non-empty string");
  }

  return value as MemberId;
}

export function asIsoDate(value: string): IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid IsoDate: ${value}`);
  }

  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const utc = Date.UTC(year, month - 1, day);

  if (
    Number.isNaN(utc) ||
    new Date(utc).getUTCFullYear() !== year ||
    new Date(utc).getUTCMonth() + 1 !== month ||
    new Date(utc).getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar day: ${value}`);
  }

  return value as IsoDate;
}
