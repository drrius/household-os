import fc from "fast-check";
import { describe, expect, it } from "vitest";

import {
  decideJobClaimReplay,
  formatScheduleKey,
  parseScheduleKey,
} from "./job-identity";
import type { JobClaim, JobClaimStatus, JobKind } from "./types";

const JOB_KINDS = [
  "deliver_due_reminders",
  "deliver_member_digests",
  "ensure_due_occurrences",
  "generate_recurring_drafts_cron",
  "retain_activity_events",
  "retain_purchased_groceries",
  "drain_push_outbox",
] as const satisfies readonly JobKind[];

const scheduleKey = formatScheduleKey(
  "deliver_member_digests",
  "global",
  "2026-08-11T07:30",
);

function claim(status: JobClaimStatus): JobClaim {
  return {
    scheduleKey,
    jobKind: "deliver_member_digests",
    status,
    attemptCount: 1,
    result: status === "succeeded" ? { delivered: 2 } : null,
    lastError: status === "failed" ? "temporary failure" : null,
    startedAt: "2026-08-11T05:30:00.000Z",
    finishedAt: status === "started" ? null : "2026-08-11T05:30:01.000Z",
  };
}

describe("job schedule keys", () => {
  it("preserves slots containing colons", () => {
    expect(parseScheduleKey(scheduleKey)).toEqual({
      jobKind: "deliver_member_digests",
      scope: "global",
      slot: "2026-08-11T07:30",
    });
  });

  it("roundtrips every job kind, scope, and slot", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...JOB_KINDS),
        fc.stringMatching(/^[a-z][a-z0-9_-]{0,20}$/),
        fc.string({ minLength: 1, maxLength: 40 }),
        (jobKind, scope, slot) => {
          const key = formatScheduleKey(jobKind, scope, slot);

          expect(parseScheduleKey(key)).toEqual({ jobKind, scope, slot });
        },
      ),
    );
  });

  it("rejects ambiguous scopes and empty slots", () => {
    expect(() =>
      formatScheduleKey("deliver_due_reminders", "household:one", "slot"),
    ).toThrow();
    expect(() =>
      formatScheduleKey("deliver_due_reminders", "global", ""),
    ).toThrow();
  });
});

describe("decideJobClaimReplay", () => {
  it("runs a schedule key with no existing claim", () => {
    expect(decideJobClaimReplay(null, scheduleKey)).toMatchObject({
      kind: "run",
      claim: {
        scheduleKey,
        jobKind: "deliver_member_digests",
        status: "started",
        attemptCount: 1,
      },
    });
  });

  it.each([
    ["started", "in_progress"],
    ["succeeded", "already_succeeded"],
  ] as const)("maps %s claims to %s", (status, expectedDecision) => {
    const existing = claim(status);

    expect(decideJobClaimReplay(existing, scheduleKey)).toEqual({
      kind: expectedDecision,
      claim: existing,
    });
  });

  it("restarts failed claims and increments the attempt count", () => {
    const existing = claim("failed");

    expect(decideJobClaimReplay(existing, scheduleKey)).toEqual({
      kind: "retry_failed",
      claim: {
        ...existing,
        status: "started",
        attemptCount: 2,
        result: null,
        lastError: null,
        finishedAt: null,
      },
    });
  });

  it("rejects a claim for a different schedule key", () => {
    const otherKey = formatScheduleKey(
      "deliver_member_digests",
      "global",
      "2026-08-12T07:30",
    );

    expect(() => decideJobClaimReplay(claim("succeeded"), otherKey)).toThrow(
      "does not match",
    );
  });
});
