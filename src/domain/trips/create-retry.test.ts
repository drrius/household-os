import { expect, it } from "vitest";
import { bookingCreateRetryMatches } from "./create-retry";
it("compares equivalent database timestamp encodings without acknowledging partner changes", () => {
  const fields = {
    title: "Flight",
    starts_at: "2026-09-05T08:00:00Z",
    ends_at: null,
    status: "idea",
  };
  const record = {
    ...fields,
    starts_at: "2026-09-05T08:00:00+00:00",
    archived_at: null,
    calendar_event_id: null,
  };
  expect(bookingCreateRetryMatches(record, fields)).toBe(true);
  for (const changes of [
    { status: "booked" },
    { archived_at: "2026-09-06T00:00:00Z" },
    { calendar_event_id: "event" },
    { title: "Changed" },
    { starts_at: "2026-09-05T09:00:00Z" },
  ])
    expect(bookingCreateRetryMatches({ ...record, ...changes }, fields)).toBe(
      false,
    );
});
