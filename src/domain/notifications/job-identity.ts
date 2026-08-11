import type {
  JobClaim,
  JobClaimDecision,
  JobKind,
  JobScheduleKey,
  ParsedScheduleKey,
} from "./types";

const JOB_KINDS: readonly JobKind[] = [
  "deliver_due_reminders",
  "deliver_member_digests",
  "ensure_due_occurrences",
  "generate_recurring_drafts_cron",
  "retain_activity_events",
  "retain_purchased_groceries",
  "drain_push_outbox",
];

function isJobKind(value: string): value is JobKind {
  return (JOB_KINDS as readonly string[]).includes(value);
}

export function formatScheduleKey(
  jobKind: JobKind,
  scope: string,
  slot: string,
): JobScheduleKey {
  if (scope.length === 0 || scope.includes(":")) {
    throw new Error("schedule key scope must be non-empty and colon-free");
  }
  if (slot.length === 0 || slot.includes(":")) {
    throw new Error("schedule key slot must be non-empty and colon-free");
  }
  return `${jobKind}:${scope}:${slot}` as JobScheduleKey;
}

export function parseScheduleKey(key: JobScheduleKey): ParsedScheduleKey {
  const parts = key.split(":");
  if (parts.length !== 3) {
    throw new Error("schedule key must have jobKind:scope:slot");
  }
  const [jobKind, scope, slot] = parts;
  if (!isJobKind(jobKind)) {
    throw new Error(`unknown job kind ${jobKind}`);
  }
  if (scope.length === 0 || slot.length === 0) {
    throw new Error("schedule key scope and slot must be non-empty");
  }
  return { jobKind, scope, slot };
}

export function decideJobClaimReplay(
  existing: JobClaim | null,
  incomingKey: JobScheduleKey,
): JobClaimDecision {
  if (existing === null) {
    return {
      kind: "run",
      claim: {
        scheduleKey: incomingKey,
        jobKind: parseScheduleKey(incomingKey).jobKind,
        status: "started",
        attemptCount: 1,
        result: null,
        lastError: null,
        startedAt: "",
        finishedAt: null,
      },
    };
  }

  if (existing.scheduleKey !== incomingKey) {
    throw new Error("job claim key mismatch");
  }

  switch (existing.status) {
    case "succeeded":
      return { kind: "already_succeeded", claim: existing };
    case "failed":
      return {
        kind: "retry_failed",
        claim: {
          ...existing,
          status: "started",
          attemptCount: existing.attemptCount + 1,
          lastError: null,
          finishedAt: null,
        },
      };
    case "started":
      return { kind: "in_progress", claim: existing };
    default: {
      const _exhaustive: never = existing.status;
      return _exhaustive;
    }
  }
}
