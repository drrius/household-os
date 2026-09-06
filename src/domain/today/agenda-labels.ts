import { Temporal } from "@js-temporal/polyfill";
import { noticeDeadline } from "@/domain/home-records/dates";
import type { AgendaBooking, AgendaCommitment } from "./agenda-types";

const zone = "Europe/Zurich";

export const zurichDay = (instant: string) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainDate()
    .toString();

export const zurichTime = (instant: string) =>
  Temporal.Instant.from(instant)
    .toZonedDateTimeISO(zone)
    .toPlainTime()
    .toString({ smallestUnit: "minute" });

export function responsibleLabel(
  members: Readonly<Record<string, string>>,
  memberId: string | null,
): string {
  return memberId ? (members[memberId] ?? "Assigned member") : "Together";
}

export function bookingDetail(
  projectTitle: string,
  status: AgendaBooking["status"],
): string {
  return `${projectTitle} · ${status === "idea" ? "Tentative booking" : "Booked"}`;
}

export function attendanceDetail(event: {
  attendance: string;
  attendeeName?: string | null;
}): string {
  return event.attendance === "both"
    ? "Together"
    : event.attendance === "one"
      ? (event.attendeeName ?? "One of us")
      : "For awareness";
}

/** The day a commitment needs attention, or null when it needs none. */
export function commitmentDeadline(
  commitment: AgendaCommitment,
  members: Readonly<Record<string, string>>,
): { day: string; detail: string } | null {
  if (
    commitment.archived_at ||
    commitment.status === "ended" ||
    !commitment.renewal_on
  )
    return null;
  const needsNotice =
    commitment.status === "active" && commitment.notice_days > 0;
  const day = needsNotice
    ? noticeDeadline(commitment.renewal_on, commitment.notice_days)
    : commitment.renewal_on;
  const reason = needsNotice
    ? "Cancellation notice due"
    : commitment.status === "cancel_requested"
      ? "Check cancellation before renewal"
      : "Renewal due";
  return {
    day,
    detail: `${reason} · ${responsibleLabel(members, commitment.responsible_member_id)}`,
  };
}
