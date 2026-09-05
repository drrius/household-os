import { expect, it } from "vitest";
import fc from "fast-check";
import { buildHouseholdAgenda } from "./agenda";
import type {
  AgendaBooking,
  AgendaCalendarEvent,
  AgendaCommitment,
  AgendaProject,
  AgendaTask,
  HouseholdAgendaInput,
} from "./agenda-types";
const project: AgendaProject = {
  id: "trip",
  title: "Our trip",
  kind: "trip",
  status: "active",
  archived_at: null,
  ends_on: null,
};
const task: AgendaTask = {
  id: "pack",
  title: "Pack passports",
  project_id: "trip",
  due_on: "2026-09-05",
  archived_at: null,
  completed_at: null,
  assigned_member_id: "partner",
};
const booking: AgendaBooking = {
  id: "flight",
  project_id: "trip",
  title: "Flight",
  starts_at: "2026-09-05T07:00:00Z",
  ends_at: "2026-09-05T09:00:00Z",
  status: "booked",
  archived_at: null,
  calendar_event_id: "event",
};
const event: AgendaCalendarEvent = {
  id: "event",
  recurrenceId: "20260905T070000Z",
  title: "Flight",
  startsAt: booking.starts_at!,
  endsAt: booking.ends_at!,
  allDay: false,
  timeZone: "Europe/Zurich",
  location: "",
  notes: "",
  isException: false,
  recurring: true,
  attendance: "both",
};
const commitment: AgendaCommitment = {
  id: "insurance",
  title: "Insurance",
  renewal_on: "2026-10-05",
  notice_days: 30,
  status: "active",
  archived_at: null,
  responsible_member_id: "viewer",
};
function input(
  values: Partial<HouseholdAgendaInput> = {},
): HouseholdAgendaInput {
  return {
    today: "2026-09-05",
    projects: [project],
    tasks: [],
    bookings: [],
    events: [],
    commitments: [],
    members: { partner: "Anna", viewer: "Dan" },
    ...values,
  };
}
it("includes overdue and upcoming responsibilities with exact destinations and both members", () => {
  const entries = buildHouseholdAgenda(
    input({
      tasks: [{ ...task, due_on: "2026-09-04" }],
      commitments: [commitment],
    }),
  );
  expect(entries.map((item) => [item.day, item.href, item.detail])).toEqual([
    ["2026-09-04", "/plan/projects/trip/tasks/pack", "Our trip · Anna"],
    [
      "2026-09-05",
      "/home/commitments/insurance",
      "Cancellation notice due · Dan",
    ],
  ]);
});
it("coalesces only explicitly linked bookings with the same timed interval", () => {
  const entries = buildHouseholdAgenda(
    input({
      bookings: [booking],
      events: [event, { ...event, id: "unrelated" }],
    }),
  );
  expect(entries).toHaveLength(2);
  expect(entries.find((item) => item.kind === "booking")).toMatchObject({
    href: "/plan/projects/trip/bookings/flight",
    time: "09:00",
    related: { href: "/plan/calendar/event?occurrence=20260905T070000Z" },
  });
  expect(entries.find((item) => item.kind === "calendar")?.href).toContain(
    "/unrelated",
  );
  const separate = buildHouseholdAgenda(
    input({
      bookings: [booking],
      events: [
        {
          ...event,
          startsAt: "2026-09-06T07:00:00Z",
          endsAt: "2026-09-06T09:00:00Z",
        },
      ],
    }),
  );
  expect(separate).toHaveLength(2);
});
it.each(["2026-03-29", "2026-10-25"])(
  "handles Zurich midnight and exclusive event ends on DST day %s",
  (today) => {
    const previous =
      today === "2026-03-29" ? "2026-03-28T23:00:00Z" : "2026-10-24T22:00:00Z";
    const expired = {
      ...event,
      id: "expired",
      startsAt: "2026-01-01T00:00:00Z",
      endsAt: previous,
    };
    const entries = buildHouseholdAgenda(
      input({
        today,
        events: [
          expired,
          { ...event, startsAt: previous, endsAt: `${today}T08:00:00Z` },
        ],
      }),
    );
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      day: today,
      time: "00:00",
      ongoing: false,
    });
  },
);
it("keeps all-day dates civil and ongoing stays visible without overdue travel", () => {
  const entries = buildHouseholdAgenda(
    input({
      events: [
        {
          ...event,
          allDay: true,
          startsAt: "2026-09-04T00:00:00Z",
          endsAt: "2026-09-06T00:00:00Z",
        },
      ],
      bookings: [
        {
          ...booking,
          calendar_event_id: null,
          starts_at: "2026-09-04T14:00:00Z",
          ends_at: "2026-09-07T09:00:00Z",
        },
        {
          ...booking,
          id: "past",
          starts_at: "2026-09-03T07:00:00Z",
          ends_at: "2026-09-03T09:00:00Z",
        },
      ],
    }),
  );
  expect(entries).toHaveLength(2);
  expect(
    entries.every(
      (item) => item.day === "2026-09-05" && item.ongoing && item.time === null,
    ),
  ).toBe(true);
});
it("does not keep completed, archived or cancelled work actionable", () => {
  for (const parent of [
    { ...project, archived_at: "2026-09-04" },
    { ...project, status: "complete" as const },
    { ...project, status: "cancelled" as const },
  ]) {
    expect(
      buildHouseholdAgenda(
        input({ projects: [parent], tasks: [task], bookings: [booking] }),
      ),
    ).toEqual([]);
  }
  expect(
    buildHouseholdAgenda(
      input({
        tasks: [{ ...task, completed_at: "2026-09-05" }],
        bookings: [{ ...booking, status: "cancelled" }],
        commitments: [{ ...commitment, status: "ended" }],
      }),
    ),
  ).toEqual([]);
});
it("changes cancellation-requested commitments to renewal follow-up rather than an already-sent notice", () => {
  expect(
    buildHouseholdAgenda(
      input({
        commitments: [
          {
            ...commitment,
            renewal_on: "2026-09-06",
            status: "cancel_requested",
          },
        ],
      }),
    )[0],
  ).toMatchObject({
    day: "2026-09-06",
    detail: "Check cancellation before renewal · Dan",
  });
});
it("keeps project targets overdue but removes historical trip ends", () => {
  const entries = buildHouseholdAgenda(
    input({
      projects: [
        { ...project, ends_on: "2026-09-04" },
        { ...project, id: "move", kind: "project", ends_on: "2026-09-04" },
      ],
    }),
  );
  expect(entries.map((entry) => entry.id)).toEqual(["project:move"]);
});
it("sorts dated work deterministically and never includes dates beyond the seven-day horizon", () => {
  fc.assert(
    fc.property(fc.uniqueArray(fc.integer({ min: 1, max: 28 })), (days) => {
      const tasks = days.map((day) => ({
        ...task,
        id: `task-${day}`,
        due_on: `2026-09-${String(day).padStart(2, "0")}`,
      }));
      const entries = buildHouseholdAgenda(input({ tasks }));
      expect(entries.every((entry) => entry.day <= "2026-09-11")).toBe(true);
      expect(entries).toEqual(
        buildHouseholdAgenda(input({ tasks: [...tasks].reverse() })),
      );
      expect(entries.length).toBe(days.filter((day) => day <= 11).length);
    }),
  );
});
it("preserves the booking time when a linked calendar interval differs", () => {
  fc.assert(
    fc.property(fc.integer({ min: 1, max: 59 }), (minute) => {
      const entries = buildHouseholdAgenda(
        input({
          bookings: [booking],
          events: [
            {
              ...event,
              startsAt: `2026-09-05T07:${String(minute).padStart(2, "0")}:00Z`,
            },
          ],
        }),
      );
      expect(entries).toHaveLength(2);
      expect(entries.find((entry) => entry.kind === "booking")).toMatchObject({
        day: "2026-09-05",
        time: "09:00",
        ongoing: false,
      });
    }),
  );
});
it("does not pull a future flight into Today through an ongoing all-day trip event", () => {
  const entries = buildHouseholdAgenda(
    input({
      bookings: [
        {
          ...booking,
          starts_at: "2026-09-15T07:00:00Z",
          ends_at: "2026-09-15T09:00:00Z",
        },
      ],
      events: [
        {
          ...event,
          allDay: true,
          startsAt: "2026-09-04T00:00:00Z",
          endsAt: "2026-09-20T00:00:00Z",
        },
      ],
    }),
  );
  expect(entries.map((entry) => entry.kind)).toEqual(["calendar"]);
  expect(entries[0]).toMatchObject({
    day: "2026-09-05",
    ongoing: true,
  });
});
