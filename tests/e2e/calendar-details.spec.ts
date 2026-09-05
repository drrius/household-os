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
