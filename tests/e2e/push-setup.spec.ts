import { expect, test } from "@playwright/test";

test("reconciles stale browser enrollment and recovers registration errors", async ({
  page,
}) => {
  await page.goto("/m7-fixture/push-setup?state=enable-error");
  await expect(page.getByText(/not enabled for your account/)).toBeVisible();
  await expect(page.getByTestId("fixture-calls")).toHaveText("");
  await page.getByRole("button", { name: "Reconnect this device" }).click();
  await expect(
    page.getByRole("button", { name: "Connecting…" }),
  ).toBeDisabled();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Registration failed. Try again.",
  );
  await page.getByRole("button", { name: "Reconnect this device" }).click();
  await expect(
    page.getByText(/Push is enabled for your account/),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Disable push on this device" })
    .click();
  await expect(page.getByText(/not enabled for your account/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Send test to this device" }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
});
test("status failure is recoverable and denied permission never prompts automatically", async ({
  page,
}) => {
  await page.goto("/m7-fixture/push-setup?state=status-error");
  await expect(page.getByText(/could not confirm whether push/)).toBeVisible();
  await page
    .getByRole("button", { name: "Restore fixture connection" })
    .click();
  await page.getByRole("button", { name: "Check push status" }).click();
  await expect(
    page.getByRole("button", { name: "Reconnect this device" }),
  ).toBeVisible();
  await page.goto("/m7-fixture/push-setup?state=denied");
  await expect(
    page.getByText(/Allow them in this browser’s site settings/),
  ).toBeVisible();
  await expect(page.getByTestId("fixture-calls")).toHaveText("");
  await expect(
    page.getByRole("button", { name: "Enable push on this device" }),
  ).toHaveCount(0);
});
test("explicit device test retries lost responses with one UUID and distinguishes acceptance", async ({
  page,
}) => {
  await page.goto("/m7-fixture/push-setup?state=test-error");
  await expect(page.getByTestId("fixture-calls")).toHaveText("");
  await page.getByRole("button", { name: "Send test to this device" }).click();
  await expect(
    page.getByRole("button", { name: "Queuing test…" }),
  ).toBeDisabled();
  await expect(page.getByRole("main").getByRole("alert")).toHaveText(
    "Response lost. Retry safely.",
  );
  await page.getByRole("button", { name: "Retry test" }).click();
  await expect(page.getByText(/Queued for this device/)).toBeVisible();
  const calls = (await page.getByTestId("fixture-calls").textContent())!.split(
    "\n",
  );
  expect(calls).toHaveLength(2);
  expect(calls[0]).toBe(calls[1]);
  await page.getByRole("button", { name: "Check test status" }).click();
  await expect(page.getByText(/Accepted by the push service/)).toBeVisible();
  await expect(
    page.getByText(/does not confirm that your device displayed it/),
  ).toBeVisible();
});
test("failed tests retain recovery controls", async ({ page }) => {
  await page.goto("/m7-fixture/push-setup?state=test-failed");
  await page.getByRole("button", { name: "Send test to this device" }).click();
  await page.getByRole("button", { name: "Check test status" }).click();
  await expect(page.getByText(/test could not be sent/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Check push status" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start another test" }).click();
  await expect(
    page.getByRole("button", { name: "Send test to this device" }),
  ).toBeVisible();
});
