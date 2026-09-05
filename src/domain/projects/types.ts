export type ProjectKind = "project" | "trip";
export type ProjectStatus = "planning" | "active" | "complete" | "cancelled";

export type HouseholdProject = {
  id: string;
  kind: ProjectKind;
  title: string;
  description: string;
  status: ProjectStatus;
  starts_on: string | null;
  ends_on: string | null;
  destination: string;
  budget_cents: number | null;
  archived_at: string | null;
  updated_at: string;
};

export type ProjectTask = {
  id: string;
  project_id: string;
  title: string;
  section: string;
  assigned_member_id: string | null;
  due_on: string | null;
  completed_at: string | null;
  completed_by_member_id: string | null;
  notes: string;
  sort_order: number;
  archived_at: string | null;
  updated_at: string;
};

export type TripBooking = {
  id: string;
  project_id: string;
  kind: "flight" | "stay" | "transport" | "activity" | "other";
  title: string;
  status: "idea" | "booked" | "cancelled";
  starts_at: string | null;
  ends_at: string | null;
  time_zone: string;
  end_time_zone: string;
  origin: string;
  destination: string;
  confirmation: string;
  website: string;
  estimated_amount_cents: number | null;
  calendar_event_id: string | null;
  notes: string;
  updated_at: string;
};

export type ProjectMember = { user_id: string; display_name: string };
