import fc from "fast-check";
import { describe, expect, it } from "vitest";

import { FormFieldError } from "./field-error";
import { parseRoutineForm } from "./routine";

const areaId = "33333333-3333-4333-8333-333333333333";
const memberId = "11111111-1111-4111-8111-111111111111";

function weekdayForm(days: readonly number[]): FormData {
  const form = new FormData();
  form.set("title", "Water the plants");
  form.set("areaId", areaId);
  form.set("assignmentPolicy", "shared");
  form.set("priority", "general");
  form.set("scheduleMode", "weekdays");
  for (const day of days) form.append("weekdays", String(day));
  return form;
}

function rejection(form: FormData): FormFieldError {
  try {
    parseRoutineForm(form);
  } catch (error) {
    if (error instanceof FormFieldError) return error;
    throw error;
  }
  throw new Error("expected the routine form to be rejected");
}

describe("routine form parsing", () => {
  it("keeps a selected weekday schedule on the calendar contract", () => {
    expect(parseRoutineForm(weekdayForm([2, 5]))).toMatchObject({
      scheduleKind: "calendar",
      scheduleRule: { kind: "weekdays", days: [2, 5] },
    });
  });

  it("keeps a biweekly schedule on the calendar contract", () => {
    const form = weekdayForm([]);
    form.set("scheduleMode", "biweekly");
    form.set("weeklyWeekday", "4");
    expect(parseRoutineForm(form)).toMatchObject({
      scheduleKind: "calendar",
      scheduleRule: { kind: "biweekly", weekday: 4 },
    });
  });

  it("attaches an empty weekday rejection to the weekday group", () => {
    const failure = rejection(weekdayForm([]));
    expect(failure.field).toBe("weekdays");
    expect(failure.message).toBe("Choose at least one weekday.");
  });

  it("attaches a repeated weekday rejection to the weekday group", () => {
    expect(rejection(weekdayForm([3, 3])).field).toBe("weekdays");
  });

  it("rejects every repeated weekday on the same field", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(fc.integer({ min: 1, max: 7 }), { minLength: 1 }),
        fc.integer({ min: 1, max: 7 }),
        (days, repeated) => {
          expect(parseRoutineForm(weekdayForm(days))).toMatchObject({
            scheduleRule: { kind: "weekdays", days },
          });
          expect(
            rejection(weekdayForm([...days, repeated, repeated])).field,
          ).toBe("weekdays");
        },
      ),
    );
  });

  it("drops the submitted member for a shared routine", () => {
    const withMember = weekdayForm([1]);
    withMember.set("memberId", memberId);
    expect(parseRoutineForm(withMember)).toMatchObject({
      assignedMemberId: null,
      rotationAnchorMemberId: null,
    });
  });

  it("accepts a shared routine that submits no member at all", () => {
    // The member control is not rendered for a shared routine, so `memberId`
    // is absent from the form data rather than empty.
    expect(weekdayForm([1]).has("memberId")).toBe(false);
    expect(parseRoutineForm(weekdayForm([1])).assignmentPolicy).toBe("shared");
  });
});
