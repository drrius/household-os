import { z } from "zod";

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
    if (days.length === 0 || new Set(days).size !== days.length) {
      throw new Error("Choose at least one unique weekday.");
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
