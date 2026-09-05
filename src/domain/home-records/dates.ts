const dayMs = 86400000;
export function validRecordDate(value: string): boolean {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(`${value}T00:00:00Z`)) &&
    new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  );
}
export function noticeDeadline(renewal: string, days: number): string {
  if (
    !validRecordDate(renewal) ||
    !Number.isInteger(days) ||
    days < 0 ||
    days > 730
  )
    throw new Error("Enter a valid renewal date and notice period.");
  return new Date(Date.parse(`${renewal}T00:00:00Z`) - days * dayMs)
    .toISOString()
    .slice(0, 10);
}
export function deadlineLabel(date: string, today: string): string {
  const days = Math.round(
    (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) /
      dayMs,
  );
  if (days < 0) return `${Math.abs(days)} days ago`;
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  return `In ${days} days`;
}

export function needsAttention(
  input: {
    renewal?: string | null;
    noticeDays?: number;
    warranty?: string | null;
    ended?: boolean;
  },
  today: string,
): boolean {
  const horizon = new Date(Date.parse(`${today}T00:00:00Z`) + 30 * dayMs)
    .toISOString()
    .slice(0, 10);
  if (input.warranty)
    return input.warranty >= today && input.warranty <= horizon;
  if (input.renewal && !input.ended)
    return noticeDeadline(input.renewal, input.noticeDays ?? 0) <= horizon;
  return false;
}
