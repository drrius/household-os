import { expect, test } from "@playwright/test";

test("Today combines shared deadlines and linked travel without duplicating the flight", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 740 });
  await page.goto("/m7-fixture/household-agenda");
  const agenda = page.getByRole("region", { name: "Our plans & deadlines" });
  await expect(
    agenda.getByText("Flight to Tokyo", { exact: true }),
  ).toHaveCount(1);
  await expect(
    agenda.getByRole("link", { name: /Pack passports/ }),
  ).toContainText("Anna");
  await expect(
    agenda.getByRole("link", { name: /Flight to Tokyo/ }),
  ).toContainText("09:00");
  await expect(
    agenda.getByRole("link", { name: "Calendar event", exact: true }),
  ).toHaveAttribute(
    "href",
    "/plan/calendar/66000000-0000-4000-8000-000000000002",
  );
  await expect(
    agenda.getByText("Home insurance", { exact: true }),
  ).toBeHidden();
  await agenda.getByText("Coming up · 1", { exact: true }).click();
  const renewal = agenda.getByRole("link", { name: /Home insurance/ });
  await expect(renewal).toContainText("Cancellation notice due · Dan");
  await renewal.scrollIntoViewIfNeeded();
  await expect(renewal).toBeInViewport();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/household-agenda-mobile.png",
    fullPage: true,
  });
  await agenda.getByRole("link", { name: /Flight to Tokyo/ }).click();
  await expect(page).toHaveURL(/\/sign-in\?returnTo=.*bookings/);
  await page.goBack();
  await expect(agenda).toBeVisible();
});

test("a refreshed agenda removes work completed by the partner", async ({
  page,
}) => {
  await page.goto("/m7-fixture/household-agenda");
  await expect(
    page.getByRole("link", { name: /Pack passports/ }),
  ).toBeVisible();
  await page.goto("/m7-fixture/household-agenda?completed=1");
  await expect(page.getByRole("link", { name: /Pack passports/ })).toHaveCount(
    0,
  );
  await expect(
    page.getByText("Flight to Tokyo", { exact: true }),
  ).toBeVisible();
});
