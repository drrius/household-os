import type { CalendarOccurrence } from "@/domain/calendar/types";
import type {
  HouseholdProject,
  ProjectTask,
  TripBooking,
} from "@/domain/projects/types";

export type AgendaProject = Pick<
  HouseholdProject,
  "id" | "title" | "kind" | "status" | "archived_at" | "ends_on"
>;
export type AgendaTask = Pick<
  ProjectTask,
  | "id"
  | "project_id"
  | "title"
  | "due_on"
  | "assigned_member_id"
  | "archived_at"
  | "completed_at"
>;
export type AgendaBooking = Pick<
  TripBooking,
  | "id"
  | "project_id"
  | "title"
  | "status"
  | "archived_at"
  | "starts_at"
  | "ends_at"
  | "calendar_event_id"
>;
export type AgendaCommitment = {
  id: string;
  title: string;
  renewal_on: string | null;
  notice_days: number;
  status: "active" | "cancel_requested" | "ended";
  archived_at: string | null;
  responsible_member_id: string | null;
};
export type AgendaCalendarEvent = CalendarOccurrence & {
  id: string;
  recurring: boolean;
  attendance: string;
  attendeeName?: string | null;
};
export type HouseholdAgendaInput = {
  today: string;
  projects: readonly AgendaProject[];
  tasks: readonly AgendaTask[];
  bookings: readonly AgendaBooking[];
  commitments: readonly AgendaCommitment[];
  events: readonly AgendaCalendarEvent[];
  members: Readonly<Record<string, string>>;
};
export type HouseholdAgendaEntry = {
  id: string;
  title: string;
  day: string;
  time: string | null;
  kind: "task" | "project" | "booking" | "calendar" | "commitment";
  detail: string;
  href: string;
  ongoing: boolean;
  related?: { href: string; label: string };
};
