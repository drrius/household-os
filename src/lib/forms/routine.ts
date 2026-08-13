import { z } from "zod";

import { FormFieldError } from "@/lib/forms/field-error";

const uuidSchema = z.string().uuid("Choose a valid household option.");
const dateSchema = z.iso.date("Choose a valid date.");
const scheduleModeSchema = z.enum([
  "one_off",
  "daily",
  "weekdays",
  "weekly",
  "monthly",
  "after_completion",
]);

function value(formData: FormData, name: string): string {
  const entry = formData.get(name);
  if (typeof entry !== "string") throw new Error(`${name} is required.`);
  return entry;
}

function optional(formData: FormData, name: string): string | null {
  const entry = formData.get(name);
  if (typeof entry !== "string" || entry.trim().length === 0) return null;
  return entry.trim();
}

function positiveInteger(raw: string, label: string, maximum: number): number {
  const parsed = /^\d+$/.test(raw) ? Number(raw) : Number.NaN;
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new Error(`${label} must be between 1 and ${maximum}.`);
  }
  return parsed;
}

function parseSchedule(formData: FormData): {
  scheduleKind: "one_off" | "calendar" | "after_completion";
  scheduleRule: Record<string, unknown>;
} {
  const mode = scheduleModeSchema.parse(value(formData, "scheduleMode"));
  if (mode === "one_off") {
    return {
      scheduleKind: "one_off",
      scheduleRule: {
        kind: "one_off",
        date: dateSchema.parse(value(formData, "oneOffDate")),
      },
    };
  }
  if (mode === "daily") {
    return { scheduleKind: "calendar", scheduleRule: { kind: "daily" } };
  }
  if (mode === "weekdays") {
    const days = formData
      .getAll("weekdays")
      .map((day) => positiveInteger(String(day), "Weekday", 7));
    // The weekday group blocks an empty submission in the browser; this stays
    // the authority, and the field keeps the message under the group.
    if (days.length === 0) {
      throw new FormFieldError("weekdays", "Choose at least one weekday.");
    }
    if (new Set(days).size !== days.length) {
      throw new FormFieldError("weekdays", "Choose each weekday only once.");
    }
    return {
      scheduleKind: "calendar",
      scheduleRule: { kind: "weekdays", days },
    };
  }
  if (mode === "weekly") {
    return {
      scheduleKind: "calendar",
      scheduleRule: {
        kind: "weekly",
        weekday: positiveInteger(
          value(formData, "weeklyWeekday"),
          "Weekday",
          7,
        ),
      },
    };
  }
  if (mode === "monthly") {
    return {
      scheduleKind: "calendar",
      scheduleRule: {
        kind: "monthly",
        dayOfMonth: positiveInteger(
          value(formData, "monthlyDay"),
          "Day of month",
          31,
        ),
      },
    };
  }
  return {
    scheduleKind: "after_completion",
    scheduleRule: {
      kind: "after_completion",
      every: positiveInteger(
        value(formData, "intervalEvery"),
        "Repeat interval",
        365,
      ),
      unit: z.enum(["days", "weeks"]).parse(value(formData, "intervalUnit")),
    },
  };
}

export function parseRoutineForm(formData: FormData) {
  const assignmentPolicy = z
    .enum(["assigned", "alternating", "shared"])
    .parse(value(formData, "assignmentPolicy"));
  const selectedMember = optional(formData, "memberId");
  if (assignmentPolicy !== "shared" && selectedMember === null) {
    throw new Error("Choose the member who starts this routine.");
  }
  const memberId =
    selectedMember === null ? null : uuidSchema.parse(selectedMember);
  return {
    title: z.string().trim().min(1).max(120).parse(value(formData, "title")),
    instructions: optional(formData, "instructions"),
    areaId: uuidSchema.parse(value(formData, "areaId")),
    petId: optional(formData, "petId")
      ? uuidSchema.parse(optional(formData, "petId"))
      : null,
    assignmentPolicy,
    assignedMemberId: assignmentPolicy === "assigned" ? memberId : null,
    rotationAnchorMemberId:
      assignmentPolicy === "alternating" ? memberId : null,
    ...parseSchedule(formData),
    priority: z
      .enum(["pet_care", "meal_deadline", "cleaning", "general"])
      .parse(value(formData, "priority")),
  };
}

export type RoutineFormValue = ReturnType<typeof parseRoutineForm>;

export type StoredRoutineSchedule = {
  scheduleKind: RoutineFormValue["scheduleKind"];
  scheduleRule: unknown;
  assignmentPolicy: RoutineFormValue["assignmentPolicy"];
  assignedMemberId: string | null;
  rotationAnchorMemberId: string | null;
};

export function routineFormChangesSchedule(
  current: StoredRoutineSchedule,
  next: RoutineFormValue,
): boolean {
  return (
    current.scheduleKind !== next.scheduleKind ||
    current.assignmentPolicy !== next.assignmentPolicy ||
    current.assignedMemberId !== next.assignedMemberId ||
    current.rotationAnchorMemberId !== next.rotationAnchorMemberId ||
    canonicalJson(normalizeScheduleRule(current.scheduleRule)) !==
      canonicalJson(normalizeScheduleRule(next.scheduleRule))
  );
}

function normalizeScheduleRule(rule: unknown): unknown {
  if (rule === null || typeof rule !== "object" || Array.isArray(rule)) {
    return rule;
  }
  const record = { ...(rule as Record<string, unknown>) };
  if (record.kind === "weekdays" && Array.isArray(record.days)) {
    record.days = [...record.days]
      .map((day) => (typeof day === "string" ? Number(day) : day))
      .sort((left, right) => Number(left) - Number(right));
  }
  return record;
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  }
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`)
    .join(",")}}`;
}
