import { describe, expect, it, vi } from "vitest";

import {
  buildHomeViewModel,
  parseHomeReadRows,
  type BuildHomeViewModelInput,
} from "./home";

vi.mock("server-only", () => ({}));

const viewerId = "user-1";
const partnerId = "user-2";

function homeInput(
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

describe("buildHomeViewModel", () => {
  it("maps household members, routine counts, pets, and recent activity", () => {
    const home = buildHomeViewModel(
      homeInput({
        storageUsedLabel: "24 MB",
        pets: [{ id: "pet-1", name: "Milo" }],
        areas: [
          { id: "area-dog", name: "Dog", sort_order: 2 },
          { id: "area-kitchen", name: "Kitchen", sort_order: 1 },
        ],
        routines: [
          {
            id: "routine-walk",
            title: "Walk Milo",
            area_id: "area-dog",
            pet_id: "pet-1",
            archived_at: null,
          },
          {
            id: "routine-kitchen",
            title: "Wipe the counters",
            area_id: "area-kitchen",
            pet_id: null,
            archived_at: null,
          },
          {
            id: "routine-archived",
            title: "Old flea check",
            area_id: "area-dog",
            pet_id: "pet-1",
            archived_at: "2026-08-11T08:00:00.000Z",
          },
        ],
        activityEvents: [
          {
            id: "activity-old",
            actor_member_id: partnerId,
            kind: "routine_archived",
            entity_type: "routine",
            entity_id: "routine-archived",
            payload: {},
            created_at: "2026-08-10T08:00:00.000Z",
          },
          {
            id: "activity-today",
            actor_member_id: viewerId,
            kind: "occurrence_completed",
            entity_type: "routine_occurrence",
            entity_id: "occurrence-1",
            payload: { routine_id: "routine-walk" },
            created_at: "2026-08-12T07:30:00.000Z",
          },
          {
            id: "activity-yesterday",
            actor_member_id: partnerId,
            kind: "expense_posted",
            entity_type: "financial_event",
            entity_id: "event-1",
            payload: {},
            created_at: "2026-08-11T17:15:00.000Z",
          },
        ],
      }),
    );

    expect(home).toEqual({
      householdLabel: "Sam & Leah",
      members: [
        { userId: partnerId, displayName: "Leah", isSelf: false },
        { userId: viewerId, displayName: "Sam", isSelf: true },
      ],
      pets: [{ id: "pet-1", name: "Milo", meta: "1 routine" }],
      areas: [
        { id: "area-kitchen", name: "Kitchen", routineCount: 1 },
        { id: "area-dog", name: "Dog", routineCount: 1 },
      ],
      routines: [
        { id: "routine-walk", title: "Walk Milo", areaName: "Dog" },
        {
          id: "routine-kitchen",
          title: "Wipe the counters",
          areaName: "Kitchen",
        },
      ],
      activity: [
        {
          id: "activity-today",
          title: "Sam completed Walk Milo",
          whenLabel: "12 Aug 2026, 09:30",
        },
        {
          id: "activity-yesterday",
          title: "Leah posted an expense",
          whenLabel: "11 Aug 2026, 19:15",
        },
        {
          id: "activity-old",
          title: "Leah archived Old flea check",
          whenLabel: "10 Aug 2026, 10:00",
        },
      ],
      storageUsedLabel: "24 MB",
    });
  });

  it("keeps optional home sections empty when no rows exist", () => {
    expect(buildHomeViewModel(homeInput())).toEqual({
      householdLabel: "Sam & Leah",
      members: [
        { userId: partnerId, displayName: "Leah", isSelf: false },
        { userId: viewerId, displayName: "Sam", isSelf: true },
      ],
      pets: [],
      areas: [],
      routines: [],
      activity: [],
      storageUsedLabel: null,
    });
  });

  it("requires the viewer and both version-one members", () => {
    expect(() => buildHomeViewModel(homeInput({ members: [] }))).toThrow(
      "Home requires exactly two household members",
    );
    expect(() =>
      buildHomeViewModel(homeInput({ viewerId: "unknown-user" })),
    ).toThrow("Home viewer must be a household member");
  });
});

describe("parseHomeReadRows", () => {
  it("rejects activity kinds outside the migration contract", () => {
    expect(() =>
      parseHomeReadRows({
        households: [],
        members: [],
        pets: [],
        areas: [],
        routines: [],
        activityEvents: [
          {
            id: "activity-1",
            actor_member_id: viewerId,
            kind: "screen_viewed",
            entity_type: "routine",
            entity_id: "routine-1",
            payload: {},
            created_at: "2026-08-12T07:30:00.000Z",
          },
        ],
      }),
    ).toThrow();
  });
});
