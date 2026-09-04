import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
});

test("routine details keep optional actions quiet and retain a rejected note", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/m7-fixture/routine-polish");
  await expect(
    page.getByText("Everything is required unless marked optional."),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Skip this occurrence" }),
  ).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Archive routine" }),
  ).not.toBeVisible();
  const key = await page
    .locator('input[name="idempotencyKey"]')
    .first()
    .inputValue();
  await page
    .getByRole("textbox", { name: "Note for your partner" })
    .fill("retry me");
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(
    page.getByText("Couldn't save. Your note is still here."),
  ).toBeVisible({ timeout: 15000 });
  await expect(
    page.getByRole("textbox", { name: "Note for your partner" }),
  ).toHaveValue("retry me");
  await expect(
    page.locator('input[name="idempotencyKey"]').first(),
  ).toHaveValue(key);
  await page
    .getByRole("textbox", { name: "Note for your partner" })
    .fill("Took the long way home.");
  await page.getByRole("button", { name: "Mark done", exact: true }).click();
  await expect(page.getByText("Saved complete", { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test("rescheduling and skipping are explicit, separate actions", async ({
  page,
}) => {
  await page.goto("/m7-fixture/routine-polish");
  await page.getByText("Move to another day", { exact: true }).click();
  await expect(
    page.getByText(
      "Only this occurrence moves. The regular schedule stays the same.",
    ),
  ).toBeVisible();
  await expect(page.locator('input[name="newDueDate"]')).toHaveValue("");
  await page.getByRole("button", { name: "Move this occurrence" }).click();
  await expect(
    page.getByText("Saved reschedule", { exact: true }),
  ).not.toBeVisible();
  await page.getByRole("button", { name: "New date", exact: true }).click();
  await page
    .getByRole("gridcell")
    .filter({ hasText: /^8$/ })
    .getByRole("button")
    .click();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Move this occurrence" }).click();
  await expect(page.getByText("Saved reschedule", { exact: true })).toBeVisible(
    { timeout: 15000 },
  );
  await page.getByText("Skip this time", { exact: true }).click();
  await page.getByRole("button", { name: "Skip this occurrence" }).click();
  await expect(page.getByText("Saved skip", { exact: true })).toBeVisible();
});

test("routine creation leads with what, who, when and discloses extra details", async ({
  page,
}) => {
  await page.goto("/m7-fixture/routine");
  await expect(
    page.getByRole("textbox", { name: "Title", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "Instructions" }),
  ).not.toBeVisible();
  await page.getByText("Area, instructions & more", { exact: true }).click();
  await expect(
    page.getByRole("textbox", { name: "Instructions" }),
  ).toBeVisible();
  await page.getByRole("combobox", { name: "Assignment" }).click();
  await page.getByRole("option", { name: "Take turns" }).click();
  await expect(
    page.getByText(
      "Turns follow the schedule, even when the other person helps or a turn is skipped.",
    ),
  ).toBeVisible();
  const widths = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
});
