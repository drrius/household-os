import type { IsoDate, IsoWeekday, RecurringExpenseSchedule } from "./types";
import { asIsoDate, isIsoWeekday } from "./values";

function splitDate(date: IsoDate): {
  year: number;
  month: number;
  day: number;
} {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function fromUtcParts(year: number, month: number, day: number): IsoDate {
  const date = new Date(Date.UTC(year, month - 1, day));
  const yyyy = String(date.getUTCFullYear()).padStart(4, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(date.getUTCDate()).padStart(2, "0");
  return asIsoDate(`${yyyy}-${mm}-${dd}`);
}

function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = splitDate(date);
  return fromUtcParts(year, month, day + days);
}

function weekday(date: IsoDate): IsoWeekday {
  const { year, month, day } = splitDate(date);
  const value = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  return (value === 0 ? 7 : value) as IsoWeekday;
}

function monthlyDate(year: number, month: number, day: number): IsoDate {
  const finalDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return fromUtcParts(year, month, Math.min(day, finalDay));
}

function nextWeeklyDate(afterDate: IsoDate, target: IsoWeekday): IsoDate {
  if (!isIsoWeekday(target)) {
    throw new Error("Weekly draft weekday must be an ISO weekday from 1 to 7");
  }
  const firstCandidate = addDays(afterDate, 1);
  const offset = (target - weekday(firstCandidate) + 7) % 7;
  return addDays(firstCandidate, offset);
}

function nextMonthlyDate(afterDate: IsoDate, dayOfMonth: number): IsoDate {
  if (!Number.isSafeInteger(dayOfMonth) || dayOfMonth < 1 || dayOfMonth > 31) {
    throw new Error("Monthly draft day must be an integer from 1 to 31");
  }
  const { year, month } = splitDate(afterDate);
  const thisMonth = monthlyDate(year, month, dayOfMonth);
  if (thisMonth > afterDate) {
    return thisMonth;
  }
  const nextMonth = new Date(Date.UTC(year, month, 1));
  return monthlyDate(
    nextMonth.getUTCFullYear(),
    nextMonth.getUTCMonth() + 1,
    dayOfMonth,
  );
}

export function nextDraftDate(
  schedule: RecurringExpenseSchedule,
  afterDate: IsoDate,
): IsoDate {
  asIsoDate(afterDate);
  switch (schedule.kind) {
    case "weekly":
      return nextWeeklyDate(afterDate, schedule.weekday);
    case "monthly":
      return nextMonthlyDate(afterDate, schedule.dayOfMonth);
    default: {
      const _exhaustive: never = schedule;
      return _exhaustive;
    }
  }
}

export function dueDraftDates(
  schedule: RecurringExpenseSchedule,
  fromInclusive: IsoDate,
  throughInclusive: IsoDate,
): IsoDate[] {
  asIsoDate(fromInclusive);
  asIsoDate(throughInclusive);
  if (fromInclusive > throughInclusive) {
    return [];
  }
  const dueDates: IsoDate[] = [];
  let candidate = nextDraftDate(schedule, addDays(fromInclusive, -1));
  while (candidate <= throughInclusive) {
    dueDates.push(candidate);
    candidate = nextDraftDate(schedule, candidate);
  }
  return dueDates;
}
