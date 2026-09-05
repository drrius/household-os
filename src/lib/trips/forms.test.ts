import { expect, it } from "vitest";
import { parseBookingForm } from "./forms";
const id = "36000000-0000-4000-8000-000000000001";
function form(values: Record<string, string> = {}) {
  const f = new FormData();
  for (const [name, value] of Object.entries({
    id,
    project_id: id,
    kind: "flight",
    title: "Zurich to New York",
    status: "booked",
    time_zone: "Europe/Zurich",
    end_time_zone: "America/New_York",
    ...values,
  }))
    f.set(name, value);
  return f;
}
it("validates actual chronology across time zones and exact CHF estimates", () => {
  const parsed = parseBookingForm(
    form({
      starts_at: "2026-09-05T10:00",
      ends_at: "2026-09-05T13:00",
      estimate: "100.05",
    }),
  );
  expect(parsed.fields).toMatchObject({
    starts_at: "2026-09-05T08:00:00Z",
    ends_at: "2026-09-05T17:00:00Z",
    estimated_amount_cents: 10005,
  });
  expect(() =>
    parseBookingForm(
      form({ starts_at: "2026-09-05T23:00", ends_at: "2026-09-05T09:00" }),
    ),
  ).toThrow("end must be after");
  expect(() =>
    parseBookingForm(form({ website: "javascript:alert(1)" })),
  ).toThrow("http");
});
it("allows undated ideas and gives a specific field for invalid clock data", () => {
  expect(
    parseBookingForm(form({ status: "idea" })).fields.starts_at,
  ).toBeNull();
  expect(() => parseBookingForm(form({ time_zone: "invalid" }))).toThrow(
    "valid named time zone",
  );
  expect(() =>
    parseBookingForm(form({ starts_at: "2026-10-25T02:30" })),
  ).toThrow("repeated");
  expect(
    parseBookingForm(
      form({ starts_at: "2026-10-25T02:30", start_clock: "later" }),
    ).fields.starts_at,
  ).toBe("2026-10-25T01:30:00Z");
});
