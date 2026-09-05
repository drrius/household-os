import { describe, expect, it } from "vitest";
import fc from "fast-check";
import { parseOccurrenceAction } from "./routine-occurrence";
import { parseHomeItem } from "./routine-home-settings";

function actionForm(note: string, intent = "complete") {
  const form = new FormData();
  form.set("occurrenceId", "f0000000-0000-4000-8000-000000000001");
  form.set("idempotencyKey", "f0000000-0000-4000-8000-000000000002");
  form.set("intent", intent);
  form.set("note", note);
  return form;
}

describe("occurrence interaction input", () => {
  it("accepts a completion note and trims it without accepting a client completion date", () => {
    const form = actionForm("  Blue lead is by the door.  ");
    form.set("completedOn", "2099-12-31");
    expect(parseOccurrenceAction(form)).toMatchObject({
      note: "Blue lead is by the door.",
      intent: "complete",
    });
    expect(parseOccurrenceAction(form)).not.toHaveProperty("completedOn");
  });
  it("validates actual reschedule dates and rejects unknown lifecycle actions", () => {
    const form = actionForm("", "reschedule");
    form.set("newDueDate", "2026-02-30");
    expect(() => parseOccurrenceAction(form)).toThrow();
    expect(() => parseOccurrenceAction(actionForm("", "delete"))).toThrow();
  });
  it("never accepts a completion note beyond the database limit", () => {
    fc.assert(
      fc.property(fc.integer({ min: 2001, max: 5000 }), (length) => {
        expect(() =>
          parseOccurrenceAction(actionForm("a".repeat(length))),
        ).toThrow();
      }),
    );
  });
  it("validates household item IDs and trims names", () => {
    const form = new FormData();
    form.set("id", "f0000000-0000-4000-8000-000000000001");
    form.set("name", " Kitchen ");
    expect(parseHomeItem(form).name).toBe("Kitchen");
    form.set("name", " ");
    expect(() => parseHomeItem(form)).toThrow();
    form.set("id", "not-an-id");
    expect(() => parseHomeItem(form)).toThrow();
  });
});
