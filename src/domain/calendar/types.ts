export type CalendarEventInput = {
  title: string;
  startsAt: string;
  endsAt: string;
  timeZone: string;
  allDay: boolean;
  attendance: "both" | "one" | "fyi";
  attendingMemberId: string | null;
  location: string;
  notes: string;
  projectId: string | null;
  recurrenceRule: string | null;
};
export type CalendarOccurrence = {
  recurrenceId: string;
  title: string;
  startsAt: string;
  endsAt: string;
  allDay: boolean;
  timeZone: string;
  location: string;
  notes: string;
  isException: boolean;
};
export type CalendarMaster = CalendarEventInput & {
  uid: string;
  cancelled: boolean;
};
