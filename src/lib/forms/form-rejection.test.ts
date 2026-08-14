import { describe, expect, it } from "vitest";

import { formRejection, settleFormAction } from "./action-state";
import { echoListSeparator } from "./echo";
import { FormFieldError } from "./field-error";

const failure = new FormFieldError("amount", "Enter an amount in francs.");
const values = { amount: "abc" };

describe("form rejection state", () => {
  it("carries the message, the field and the echoed values", () => {
    expect(formRejection({ submissionId: 0 }, failure, values)).toEqual({
      error: "Enter an amount in francs.",
      field: "amount",
      values: { amount: "abc" },
      submissionId: 1,
    });
  });

  it("changes state when the identical failure repeats", () => {
    const first = formRejection({ submissionId: 0 }, failure, values);
    const second = formRejection(first, failure, values);
    const third = formRejection(second, failure, values);

    expect([
      first.submissionId,
      second.submissionId,
      third.submissionId,
    ]).toEqual([1, 2, 3]);
    expect(second.error).toBe(first.error);
    expect(second.field).toBe(first.field);
    expect(second.values).toEqual(first.values);
    expect(second).not.toEqual(first);
    expect(third).not.toEqual(second);
  });

  it("keeps counting from whatever the form last rendered", () => {
    expect(
      formRejection({ submissionId: 41 }, failure, values).submissionId,
    ).toBe(42);
  });

  it("leaves the field undefined when the failure names no control", () => {
    const rejected = formRejection(
      { submissionId: 0 },
      new Error("The household is already settled up."),
      {},
    );

    expect(rejected.field).toBeUndefined();
    expect(rejected.error).toBe("The household is already settled up.");
  });
});

describe("settleFormAction", () => {
  it("returns null so redirect can stay outside the try", async () => {
    const form = new FormData();
    form.set("name", "Kitchen");
    await expect(
      settleFormAction({ submissionId: 0 }, form, async () => undefined),
    ).resolves.toBeNull();
  });

  it("echoes the submitted fields on rejection", async () => {
    const form = new FormData();
    form.set("amount", "abc");
    form.set("saveToLibrary", "on");
    form.append("weekdays", "1");
    form.append("weekdays", "5");
    const rejected = await settleFormAction(
      { submissionId: 3 },
      form,
      async () => {
        throw new FormFieldError("amount", "Enter an amount in francs.");
      },
    );
    expect(rejected).toEqual({
      error: "Enter an amount in francs.",
      field: "amount",
      values: {
        amount: "abc",
        saveToLibrary: "on",
        weekdays: `1${echoListSeparator}5`,
      },
      submissionId: 4,
    });
  });
});
