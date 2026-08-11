import { describe, expect, it } from "vitest";

import {
  decideJobClaimReplay,
  formatScheduleKey,
  parseScheduleKey,
} from "./job-identity";
import type { JobClaim } from "./types";

describe("schedule keys", () => {
  it("round-trips job kind, scope, and slot", () => {
    const key = formatScheduleKey(
      "deliver_member_digests",
      "global",
      "2026-08-11T08-00",
    );
    expect(parseScheduleKey(key)).toEqual({
      jobKind: "deliver_member_digests",
      scope: "global",
      slot: "2026-08-11T08-00",
    });
  });

  it("rejects colons inside scope or slot", () => {
    expect(() =>
      formatScheduleKey("retain_activity_events", "a:b", "day"),
    ).toThrow();
  });
});

describe("decideJobClaimReplay", () => {
  const key = formatScheduleKey("deliver_due_reminders", "global", "slot-1");

  it("runs when no prior claim exists", () => {
    expect(decideJobClaimReplay(null, key).kind).toBe("run");
  });

  it("skips successful claims", () => {
    const existing: JobClaim = {
      scheduleKey: key,
      jobKind: "deliver_due_reminders",
      status: "succeeded",
      attemptCount: 1,
      result: { delivered: 1 },
      lastError: null,
      startedAt: "2026-08-11T08:00:00Z",
      finishedAt: "2026-08-11T08:00:01Z",
    };
    expect(decideJobClaimReplay(existing, key)).toEqual({
      kind: "already_succeeded",
      claim: existing,
    });
  });

  it("retries failed claims", () => {
    const existing: JobClaim = {
      scheduleKey: key,
      jobKind: "deliver_due_reminders",
      status: "failed",
      attemptCount: 1,
      result: null,
      lastError: "timeout",
      startedAt: "2026-08-11T08:00:00Z",
      finishedAt: "2026-08-11T08:00:02Z",
    };
    const decision = decideJobClaimReplay(existing, key);
    expect(decision.kind).toBe("retry_failed");
    if (decision.kind === "retry_failed") {
      expect(decision.claim.attemptCount).toBe(2);
      expect(decision.claim.status).toBe("started");
    }
  });

  it("does not re-enter an in-progress claim", () => {
    const existing: JobClaim = {
      scheduleKey: key,
      jobKind: "deliver_due_reminders",
      status: "started",
      attemptCount: 1,
      result: null,
      lastError: null,
      startedAt: "2026-08-11T08:00:00Z",
      finishedAt: null,
    };
    expect(decideJobClaimReplay(existing, key).kind).toBe("in_progress");
  });
});
