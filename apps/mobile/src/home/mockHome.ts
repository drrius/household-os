import type { HomeViewModel, InboxViewModel } from "./types";

export const mockHome: HomeViewModel = {
  householdLabel: "Our household",
  members: [
    { userId: "mock-user", displayName: "Alex", isSelf: true },
    { userId: "mock-partner", displayName: "Sam", isSelf: false },
  ],
  pets: [{ id: "pet-1", name: "Milo" }],
  areas: [
    { id: "area-1", name: "Kitchen" },
    { id: "area-2", name: "Living room" },
  ],
  routines: [
    { id: "r-1", title: "Feed Milo", areaName: "Kitchen", paused: false },
    { id: "r-2", title: "Vacuum living room", areaName: "Living room", paused: false },
  ],
  activity: [{ id: "a-1", title: "Sam completed Feed Milo" }],
};

export const mockInbox: InboxViewModel = {
  unreadCount: 1,
  items: [
    {
      id: "n-1",
      title: "Expense posted",
      body: "Sam recorded Coop weekly shop.",
      read: false,
    },
  ],
};
