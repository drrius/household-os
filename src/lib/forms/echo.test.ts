import { describe, expect, it } from "vitest";

import { echoValues, echoedList } from "./echo";

describe("echoValues", () => {
  it("copies every string field except a fresh idempotency key", () => {
    const form = new FormData();
    form.set("title", "Walk the dog");
    form.set("idempotencyKey", "44444444-4444-4444-8444-444444444444");
    form.set("note", "");
    expect(echoValues(form)).toEqual({
      title: "Walk the dog",
      note: "",
    });
  });

  it("restores weekday checkboxes from getAll", () => {
    const form = new FormData();
    form.set("scheduleMode", "weekdays");
    form.append("weekdays", "1");
    form.append("weekdays", "5");
    const values = echoValues(form);
    expect(echoedList(values.weekdays)).toEqual(["1", "5"]);
    expect(values.scheduleMode).toBe("weekdays");
  });
});
