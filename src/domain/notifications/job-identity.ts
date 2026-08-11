import type {
  JobClaim,
  JobClaimDecision,
  JobKind,
  JobScheduleKey,
  ParsedScheduleKey,
} from "./types";

const JOB_KIND_CATALOG: Readonly<Record<JobKind, true>> = {
  deliver_due_reminders: true,
  deliver_member_digests: true,
  ensure_due_occurrences: true,
  generate_recurring_drafts_cron: true,
  retain_activity_events: true,
  retain_purchased_groceries: true,
  drain_push_outbox: true,
};

function isJobKind(value: string): value is JobKind {
  return Object.hasOwn(JOB_KIND_CATALOG, value);
}

export function formatScheduleKey(
  jobKind: JobKind,
  scope: string,
  slot: string,
): JobScheduleKey {
  if (scope.length === 0 || scope.includes(":")) {
    throw new Error(
      "Job schedule scope must be non-empty and contain no colon",
    );
  }

  if (slot.length === 0) {
    throw new Error("Job schedule slot must be non-empty");
  }

  return `${jobKind}:${scope}:${slot}` as JobScheduleKey;
}

export function parseScheduleKey(key: JobScheduleKey): ParsedScheduleKey {
  const firstSeparator = key.indexOf(":");
  const secondSeparator = key.indexOf(":", firstSeparator + 1);

  if (firstSeparator <= 0 || secondSeparator <= firstSeparator + 1) {
    throw new Error(`Invalid job schedule key: ${key}`);
  }

  const jobKind = key.slice(0, firstSeparator);
  const scope = key.slice(firstSeparator + 1, secondSeparator);
  const slot = key.slice(secondSeparator + 1);

  if (!isJobKind(jobKind)) {
    throw new Error(`Unknown job kind: ${jobKind}`);
  }

  if (slot.length === 0) {
    throw new Error(`Invalid job schedule key: ${key}`);
  }

  return { jobKind, scope, slot };
}

function newJobClaim(incomingKey: JobScheduleKey): JobClaim {
  const parsedKey = parseScheduleKey(incomingKey);

  return {
    scheduleKey: incomingKey,
    jobKind: parsedKey.jobKind,
    status: "started",
    attemptCount: 1,
    result: null,
    lastError: null,
    startedAt: parsedKey.slot,
    finishedAt: null,
  };
}

export function decideJobClaimReplay(
  existing: JobClaim | null,
  incomingKey: JobScheduleKey,
): JobClaimDecision {
  if (existing === null) {
    return { kind: "run", claim: newJobClaim(incomingKey) };
  }

  if (existing.scheduleKey !== incomingKey) {
    throw new Error("Existing claim does not match the incoming schedule key");
  }

  const parsedKey = parseScheduleKey(incomingKey);

  if (existing.jobKind !== parsedKey.jobKind) {
    throw new Error("Existing claim job kind does not match its schedule key");
  }

  switch (existing.status) {
    case "started":
      return { kind: "run", claim: existing };
    case "succeeded":
      return { kind: "already_succeeded", claim: existing };
    case "failed":
      return { kind: "retry_failed", claim: existing };
    default: {
      const _exhaustive: never = existing.status;
      return _exhaustive;
    }
  }
}
