import { expect, it } from "vitest";
import { parseCalendarForm } from "./forms";
const form = {
  title: "Weekend",
  start: "2026-09-12T10:00",
  end: "2026-09-12T11:00",
  timeZone: "Europe/Zurich",
  attendance: "both",
  attendingMemberId: "",
  projectId: "",
  location: "",
  notes: "",
  repeat: "none",
  until: "",
};
it("requires a real member selection when one person is going", () => {
  expect(() => parseCalendarForm({ ...form, attendance: "one" })).toThrow(
    "Choose who",
  );
  expect(() =>
    parseCalendarForm({ ...form, attendingMemberId: "not-a-member-id" }),
  ).toThrow();
});
it("stores all-day multi-day plans with exclusive end dates", () => {
  expect(
    parseCalendarForm({ ...form, allDay: "on", end: "2026-09-14" }),
  ).toMatchObject({
    startsAt: "2026-09-12T00:00:00Z",
    endsAt: "2026-09-15T00:00:00Z",
  });
});
it("rejects backwards ranges and ambiguous clock-change times", () => {
  expect(() => parseCalendarForm({ ...form, end: "2026-09-11T10:00" })).toThrow(
    "end must be after",
  );
  expect(() =>
    parseCalendarForm({
      ...form,
      start: "2026-10-25T02:30",
      end: "2026-10-25T03:30",
    }),
  ).toThrow("skipped or repeated");
});
it("builds UTC UNTIL for timed repeats and keeps imported rules unchanged", () => {
  expect(
    parseCalendarForm({ ...form, repeat: "weekly", until: "2026-09-30" })
      .recurrenceRule,
  ).toBe("FREQ=WEEKLY;UNTIL=20260930T215959Z");
  expect(
    parseCalendarForm(
      { ...form, repeat: "keep", until: "2026-09-30" },
      "FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2",
    ).recurrenceRule,
  ).toBe("FREQ=MONTHLY;BYDAY=MO;BYSETPOS=2");
});
