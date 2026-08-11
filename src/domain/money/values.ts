import type {
  CentimeAmount,
  FinancialEventId,
  IsoDate,
  IsoWeekday,
  MemberId,
  MonthlyDay,
} from "./types";

export function asMemberId(value: string): MemberId {
  if (value.length === 0) {
    throw new Error("MemberId must be a non-empty string");
  }
  return value as MemberId;
}

export function asFinancialEventId(value: string): FinancialEventId {
  if (value.length === 0) {
    throw new Error("FinancialEventId must be a non-empty string");
  }
  return value as FinancialEventId;
}

export function asCentimeAmount(value: number): CentimeAmount {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(
      "Amount must be a non-negative safe integer number of centimes",
    );
  }
  return value as CentimeAmount;
}

export function assertSignedCentimes(value: number, label: string): void {
  if (!Number.isSafeInteger(value)) {
    throw new Error(`${label} must be safe integer centimes`);
  }
}

export function addSignedCentimes(
  left: number,
  right: number,
  label: string,
): number {
  const total = left + right;
  assertSignedCentimes(total, label);
  return total;
}

export function asIsoDate(value: string): IsoDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Invalid IsoDate: ${value}`);
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const resolved = new Date(Date.UTC(year, month - 1, day));
  if (
    resolved.getUTCFullYear() !== year ||
    resolved.getUTCMonth() + 1 !== month ||
    resolved.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar day: ${value}`);
  }
  return value as IsoDate;
}

export function isIsoWeekday(value: number): value is IsoWeekday {
  return Number.isSafeInteger(value) && value >= 1 && value <= 7;
}

export function asMonthlyDay(value: number): MonthlyDay {
  if (!Number.isSafeInteger(value) || value < 1 || value > 31) {
    throw new Error("Monthly day must be an integer from 1 to 31");
  }
  return value as MonthlyDay;
}
