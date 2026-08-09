import {
  addDays,
  clampDayOfMonth,
  compareIsoDates,
  fromUtcParts,
  isoWeekday,
  splitIsoDate,
} from "./dates";
import {
  asIsoDate,
  type IsoDate,
  type IsoWeekday,
  type ScheduleKind,
  type ScheduleRule,
} from "./types";

export type ScheduleValidationError = {
  code:
    | "kind_mismatch"
    | "empty_weekdays"
    | "duplicate_weekdays"
    | "invalid_day_of_month"
    | "invalid_interval"
    | "invalid_rule";
  message: string;
};

export type ScheduleValidationResult =
  | { ok: true; rule: ScheduleRule }
  | { ok: false; error: ScheduleValidationError };

function isIsoWeekday(value: number): value is IsoWeekday {
  return Number.isSafeInteger(value) && value >= 1 && value <= 7;
}

function scheduleKindForRule(rule: ScheduleRule): ScheduleKind {
  switch (rule.kind) {
    case "one_off":
      return "one_off";
    case "after_completion":
      return "after_completion";
    case "daily":
    case "weekdays":
    case "weekly":
    case "monthly":
      return "calendar";
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

export function validateScheduleRule(
  scheduleKind: ScheduleKind,
  rule: ScheduleRule,
): ScheduleValidationResult {
  if (scheduleKindForRule(rule) !== scheduleKind) {
    return {
      ok: false,
      error: {
        code: "kind_mismatch",
        message: `Schedule kind ${scheduleKind} does not match rule ${rule.kind}`,
      },
    };
  }

  switch (rule.kind) {
    case "one_off":
      try {
        return { ok: true, rule: { kind: "one_off", date: asIsoDate(rule.date) } };
      } catch {
        return {
          ok: false,
          error: { code: "invalid_rule", message: "one_off date is invalid" },
        };
      }
    case "daily":
      return { ok: true, rule };
    case "weekdays": {
      if (rule.days.length === 0) {
        return {
          ok: false,
          error: { code: "empty_weekdays", message: "weekdays requires at least one day" },
        };
      }

      const unique = new Set<IsoWeekday>();
      for (const day of rule.days) {
        if (!isIsoWeekday(day)) {
          return {
            ok: false,
            error: {
              code: "invalid_rule",
              message: "weekdays must be ISO weekdays 1-7",
            },
          };
        }

        if (unique.has(day)) {
          return {
            ok: false,
            error: {
              code: "duplicate_weekdays",
              message: "weekdays must be unique",
            },
          };
        }

        unique.add(day);
      }

      const days = [...unique].sort((a, b) => a - b);
      return { ok: true, rule: { kind: "weekdays", days } };
    }
    case "weekly":
      if (!isIsoWeekday(rule.weekday)) {
        return {
          ok: false,
          error: {
            code: "invalid_rule",
            message: "weekly weekday must be ISO weekday 1-7",
          },
        };
      }

      return { ok: true, rule };
    case "monthly":
      if (
        !Number.isSafeInteger(rule.dayOfMonth) ||
        rule.dayOfMonth < 1 ||
        rule.dayOfMonth > 31
      ) {
        return {
          ok: false,
          error: {
            code: "invalid_day_of_month",
            message: "monthly dayOfMonth must be 1-31",
          },
        };
      }

      return { ok: true, rule };
    case "after_completion":
      if (!Number.isSafeInteger(rule.every) || rule.every < 1) {
        return {
          ok: false,
          error: {
            code: "invalid_interval",
            message: "after_completion every must be a positive integer",
          },
        };
      }

      if (rule.unit !== "days" && rule.unit !== "weeks") {
        return {
          ok: false,
          error: {
            code: "invalid_rule",
            message: "after_completion unit must be days or weeks",
          },
        };
      }

      return { ok: true, rule };
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

function nextWeekdayOnOrAfter(
  fromInclusive: IsoDate,
  weekday: IsoWeekday,
): IsoDate {
  const current = isoWeekday(fromInclusive);
  const delta = (weekday - current + 7) % 7;
  return addDays(fromInclusive, delta);
}

function nextMatchingWeekday(
  fromExclusive: IsoDate,
  days: readonly IsoWeekday[],
): IsoDate {
  const sorted = [...days].sort((a, b) => a - b);
  let candidate = addDays(fromExclusive, 1);

  for (let step = 0; step < 8; step += 1) {
    if (sorted.includes(isoWeekday(candidate))) {
      return candidate;
    }

    candidate = addDays(candidate, 1);
  }

  throw new Error("Failed to find next weekday match");
}

function nextMonthlyOnOrAfter(
  fromInclusive: IsoDate,
  dayOfMonth: number,
): IsoDate {
  const { year, month, day } = splitIsoDate(fromInclusive);
  const clampedThisMonth = clampDayOfMonth(year, month, dayOfMonth);
  const thisMonthDate = fromUtcParts(year, month, clampedThisMonth);

  if (compareIsoDates(thisMonthDate, fromInclusive) >= 0) {
    return thisMonthDate;
  }

  const nextMonthUtc = Date.UTC(year, month, 1);
  const next = new Date(nextMonthUtc);
  const nextYear = next.getUTCFullYear();
  const nextMonth = next.getUTCMonth() + 1;
  return fromUtcParts(
    nextYear,
    nextMonth,
    clampDayOfMonth(nextYear, nextMonth, dayOfMonth),
  );
}

/**
 * Next calendar due date strictly after `afterDate`.
 * Calendar recurrence follows the calendar anchor, not completion time.
 */
export function nextCalendarDueDate(
  rule: Extract<
    ScheduleRule,
    { kind: "daily" | "weekdays" | "weekly" | "monthly" }
  >,
  afterDate: IsoDate,
): IsoDate {
  switch (rule.kind) {
    case "daily":
      return addDays(afterDate, 1);
    case "weekdays":
      return nextMatchingWeekday(afterDate, rule.days);
    case "weekly":
      return nextWeekdayOnOrAfter(addDays(afterDate, 1), rule.weekday);
    case "monthly":
      return nextMonthlyOnOrAfter(addDays(afterDate, 1), rule.dayOfMonth);
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

/** First due date on or after `fromInclusive` for calendar and one-off rules. */
export function firstDueDateOnOrAfter(
  rule: ScheduleRule,
  fromInclusive: IsoDate,
): IsoDate {
  switch (rule.kind) {
    case "one_off":
      return rule.date;
    case "daily":
      return fromInclusive;
    case "weekdays":
      if (rule.days.includes(isoWeekday(fromInclusive))) {
        return fromInclusive;
      }

      return nextMatchingWeekday(fromInclusive, rule.days);
    case "weekly":
      return nextWeekdayOnOrAfter(fromInclusive, rule.weekday);
    case "monthly":
      return nextMonthlyOnOrAfter(fromInclusive, rule.dayOfMonth);
    case "after_completion":
      return nextAfterCompletionDueDate(rule, fromInclusive);
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

export function nextAfterCompletionDueDate(
  rule: Extract<ScheduleRule, { kind: "after_completion" }>,
  completedOn: IsoDate,
): IsoDate {
  const days = rule.unit === "weeks" ? rule.every * 7 : rule.every;
  return addDays(completedOn, days);
}

export function nextDueAfterClosure(input: {
  rule: ScheduleRule;
  closedDueDate: IsoDate;
  completedOn?: IsoDate;
}): IsoDate | null {
  const { rule, closedDueDate, completedOn } = input;

  switch (rule.kind) {
    case "one_off":
      return null;
    case "after_completion": {
      if (completedOn === undefined) {
        return nextCalendarAnchorAfterSkip(rule, closedDueDate);
      }

      return nextAfterCompletionDueDate(rule, completedOn);
    }
    case "daily":
    case "weekdays":
    case "weekly":
    case "monthly":
      return nextCalendarDueDate(rule, closedDueDate);
    default: {
      const _exhaustive: never = rule;
      return _exhaustive;
    }
  }
}

function nextCalendarAnchorAfterSkip(
  rule: Extract<ScheduleRule, { kind: "after_completion" }>,
  closedDueDate: IsoDate,
): IsoDate {
  return nextAfterCompletionDueDate(rule, closedDueDate);
}
