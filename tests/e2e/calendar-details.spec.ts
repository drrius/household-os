import { expect, test } from "@playwright/test";
test("event details show the timed end and an honest custom-zone fallback", async ({
  page,
}) => {
  await page.goto("/m7-fixture/calendar-details");
  await expect(page.getByText(/10:00 – 12:30 · Europe\/Zurich/)).toBeVisible();
  await page.goto("/m7-fixture/calendar-details?surface=custom");
  await expect(
    page.getByText(/08:00 – 10:30 · UTC \(converted from Custom\/Fixed\)/),
  ).toBeVisible();
});
test("all-day details include the last occupied day without exposing the exclusive boundary", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/calendar-details?surface=all-day");
  await expect(
    page.getByText(
      /Monday, 7 September 2026 – Wednesday, 9 September 2026 · All day/,
    ),
  ).toBeVisible();
  await expect(page.getByText(/10 September/)).toHaveCount(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("calendar-details.png"),
    fullPage: true,
    caret: "initial",
  });
});

test("conflict comparison uses readable local intervals and distinguishes unreadable data", async ({
  page,
}) => {
  const hydrationErrors: string[] = [];
  page.on("console", (message) => {
    if (/hydration|hydrated|server rendered HTML/i.test(message.text()))
      hydrationErrors.push(message.text());
  });
  await page.goto("/m7-fixture/calendar-details?surface=conflict");
  const card = page.locator("section").filter({
    has: page.getByRole("heading", { name: "Two versions need a decision" }),
  });
  await expect(
    card.getByText(/10:00 – 12:30 · Europe\/Zurich · By the lake/),
  ).toBeVisible();
  await expect(card.getByText(/11:00 – 13:30 · Europe\/Zurich$/)).toBeVisible();
  await page.goto("/m7-fixture/calendar-details?surface=unreadable-conflict");
  await expect(
    page.getByText(
      "This Apple Calendar version could not be read. Open Apple Calendar to inspect it.",
    ),
  ).toBeVisible();
  await expect(
    page.getByText("Deleted in Apple Calendar", { exact: true }),
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "Version to keep" }).click();
  await expect(
    page.getByRole("option", {
      name: "Keep Apple Calendar version",
      exact: true,
    }),
  ).toBeVisible();
  expect(hydrationErrors).toEqual([]);
});
