import type { BuildHomeViewModelInput } from "./home";

export const viewerId = "user-1";
export const partnerId = "user-2";

export function homeInput(
  overrides: Partial<BuildHomeViewModelInput> = {},
): BuildHomeViewModelInput {
  return {
    viewerId,
    households: [{ id: "household-1", name: "Sam & Leah" }],
    members: [
      {
        user_id: viewerId,
        display_name: "Sam",
        joined_at: "2026-08-02T10:00:00.000Z",
      },
      {
        user_id: partnerId,
        display_name: "Leah",
        joined_at: "2026-08-01T10:00:00.000Z",
      },
    ],
    pets: [],
    areas: [],
    routines: [],
    activityEvents: [],
    ...overrides,
  };
}
