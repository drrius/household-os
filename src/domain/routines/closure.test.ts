import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  planInitialOccurrenceWindow,
  planOccurrenceClosure,
  type OpenOccurrence,
  type RoutineClosureContext,
} from "./closure";
import { nextDueAfterClosure } from "./schedule";
import {
  asIsoDate,
  asMemberId,
  type OccurrenceId,
  type ScheduleRule,
} from "./types";

const memberA = asMemberId("member-a");
const memberB = asMemberId("member-b");
const members = [memberA, memberB] as const;

function occurrence(
  id: string,
  role: "current" | "preview",
  dueDate: string,
  plannedAssigneeId: ReturnType<typeof asMemberId> | null = memberA,
): OpenOccurrence {
  const date = asIsoDate(dueDate);
  return {
    id: id as OccurrenceId,
    role,
    dueDate: date,
    originalDueDate: date,
    plannedAssigneeId,
    status: "open",
  };
}

function context(
  partial: Partial<RoutineClosureContext> & {
    scheduleRule: ScheduleRule;
  },
): RoutineClosureContext {
  return {
    assignment: { policy: "alternating", anchorMemberId: memberA },
    members,
    active: true,
    current: occurrence("cur", "current", "2026-08-09"),
    preview: occurrence("prev", "preview", "2026-08-10", memberB),
    ...partial,
  };
}

describe("planInitialOccurrenceWindow", () => {
  it("creates current and preview for recurring calendar routines", () => {
    const window = planInitialOccurrenceWindow({
      assignment: { policy: "assigned", memberId: memberA },
      members,
      scheduleRule: { kind: "daily" },
      firstDueDate: asIsoDate("2026-08-09"),
    });

    expect(window).toHaveLength(2);
    expect(window[0]).toMatchObject({
      role: "current",
      dueDate: "2026-08-09",
      plannedAssigneeId: memberA,
    });
    expect(window[1]).toMatchObject({
      role: "preview",
      dueDate: "2026-08-10",
      plannedAssigneeId: memberA,
    });
  });

  it("creates only current for one-off routines", () => {
    const window = planInitialOccurrenceWindow({
      assignment: { policy: "shared" },
      members,
      scheduleRule: { kind: "one_off", date: asIsoDate("2026-08-09") },
      firstDueDate: asIsoDate("2026-08-09"),
    });

    expect(window).toEqual([
      {
        role: "current",
        dueDate: "2026-08-09",
        originalDueDate: "2026-08-09",
        plannedAssigneeId: null,
        status: "open",
      },
    ]);
  });
});

describe("planOccurrenceClosure", () => {
  it("completing a daily routine promotes preview and adds one new preview", () => {
    const result = planOccurrenceClosure(
      context({ scheduleRule: { kind: "daily" } }),
      {
        kind: "complete",
        occurrenceId: "cur" as OccurrenceId,
        actorMemberId: memberB,
        completedOn: asIsoDate("2026-08-09"),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.plan.nextStatus).toBe("completed");
    expect(result.plan.completion?.completedByMemberId).toBe(memberB);
    expect(result.plan.promotePreviewToCurrent).toBe(true);
    expect(result.plan.createOccurrences).toHaveLength(1);
    expect(result.plan.createOccurrences[0]?.role).toBe("preview");
    expect(result.plan.createOccurrences[0]?.dueDate).toBe("2026-08-11");
    expect(result.plan.createOccurrences[0]?.plannedAssigneeId).toBe(memberA);
  });

  it("completion-based next due uses completion day, not the prior due date", () => {
    const result = planOccurrenceClosure(
      context({
        scheduleRule: { kind: "after_completion", every: 3, unit: "days" },
        preview: occurrence("prev", "preview", "2026-08-12", memberB),
      }),
      {
        kind: "complete",
        occurrenceId: "cur" as OccurrenceId,
        actorMemberId: memberA,
        completedOn: asIsoDate("2026-08-11"),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.plan.discardPreview).toBe(true);
    expect(result.plan.promotePreviewToCurrent).toBe(false);
    expect(result.plan.createOccurrences[0]).toMatchObject({
      role: "current",
      dueDate: "2026-08-14",
      plannedAssigneeId: memberB,
    });
    expect(result.plan.createOccurrences[1]).toMatchObject({
      role: "preview",
      dueDate: "2026-08-17",
      plannedAssigneeId: memberA,
    });
  });

  it("skip preserves calendar cadence from the closed due date", () => {
    const result = planOccurrenceClosure(
      context({ scheduleRule: { kind: "daily" } }),
      {
        kind: "skip",
        occurrenceId: "cur" as OccurrenceId,
        actorMemberId: memberA,
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.plan.nextStatus).toBe("skipped");
    expect(result.plan.completion).toBeNull();
    expect(result.plan.promotePreviewToCurrent).toBe(true);
    expect(result.plan.createOccurrences[0]?.dueDate).toBe("2026-08-11");
  });

  it("reschedule keeps the occurrence open and refreshes preview", () => {
    const result = planOccurrenceClosure(
      context({ scheduleRule: { kind: "daily" } }),
      {
        kind: "reschedule",
        occurrenceId: "cur" as OccurrenceId,
        actorMemberId: memberA,
        newDueDate: asIsoDate("2026-08-12"),
      },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }

    expect(result.plan.nextStatus).toBe("open");
    expect(result.plan.rescheduledDueDate).toBe("2026-08-12");
    expect(result.plan.discardPreview).toBe(true);
    expect(result.plan.createOccurrences).toEqual([
      {
        role: "preview",
        dueDate: "2026-08-13",
        originalDueDate: "2026-08-13",
        plannedAssigneeId: memberB,
        status: "open",
      },
    ]);
  });

  it("every closure path yields at most one successor current occurrence", () => {
    const rules: ScheduleRule[] = [
      { kind: "daily" },
      { kind: "weekly", weekday: 3 },
      { kind: "monthly", dayOfMonth: 15 },
      { kind: "after_completion", every: 2, unit: "days" },
      { kind: "one_off", date: asIsoDate("2026-08-09") },
    ];

    fc.assert(
      fc.property(
        fc.constantFrom(...rules),
        fc.constantFrom<"complete" | "skip">("complete", "skip"),
        (scheduleRule, kind) => {
          const previewDue =
            nextDueAfterClosure({
              rule: scheduleRule,
              closedDueDate: asIsoDate("2026-08-09"),
            }) ?? asIsoDate("2026-08-10");

          const result = planOccurrenceClosure(
            context({
              scheduleRule,
              preview:
                scheduleRule.kind === "one_off"
                  ? null
                  : occurrence("prev", "preview", previewDue, memberB),
            }),
            kind === "complete"
              ? {
                  kind: "complete",
                  occurrenceId: "cur" as OccurrenceId,
                  actorMemberId: memberA,
                  completedOn: asIsoDate("2026-08-09"),
                }
              : {
                  kind: "skip",
                  occurrenceId: "cur" as OccurrenceId,
                  actorMemberId: memberA,
                },
          );

          expect(result.ok).toBe(true);
          if (!result.ok) {
            return;
          }

          const createdCurrents = result.plan.createOccurrences.filter(
            (row) => row.role === "current",
          );
          const createdPreviews = result.plan.createOccurrences.filter(
            (row) => row.role === "preview",
          );

          expect(createdCurrents.length).toBeLessThanOrEqual(1);
          expect(createdPreviews.length).toBeLessThanOrEqual(1);

          if (result.plan.promotePreviewToCurrent) {
            expect(createdCurrents).toHaveLength(0);
          }

          if (scheduleRule.kind === "one_off") {
            expect(createdCurrents).toHaveLength(0);
            expect(createdPreviews).toHaveLength(0);
          }
        },
      ),
    );
  });

  it("rejects completing the preview occurrence", () => {
    const result = planOccurrenceClosure(
      context({ scheduleRule: { kind: "daily" } }),
      {
        kind: "complete",
        occurrenceId: "prev" as OccurrenceId,
        actorMemberId: memberA,
        completedOn: asIsoDate("2026-08-10"),
      },
    );

    expect(result.ok).toBe(false);
  });
});
