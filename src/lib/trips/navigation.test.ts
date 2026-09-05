import { expect, it } from "vitest";
import { bookingBack } from "./navigation";
it("keeps only this trip's paging and archive context", () => {
  expect(
    bookingBack(
      "trip",
      "/plan/projects/trip?bookingPage=2&archivedBookings=1&taskPage=3&unsafe=x",
    ),
  ).toBe(
    "/plan/projects/trip?bookingPage=2&taskPage=3&archivedBookings=1#itinerary",
  );
  for (const unsafe of [
    "https://elsewhere.invalid/plan/projects/trip",
    "//elsewhere.invalid/plan/projects/trip",
    "/plan/projects/another",
    "javascript:alert(1)",
  ])
    expect(bookingBack("trip", unsafe)).toBe("/plan/projects/trip#itinerary");
});
