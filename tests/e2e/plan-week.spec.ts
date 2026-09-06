import { expect, test } from "@playwright/test";

test("the household week shows plans, routines and meals per day on a phone", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m7-fixture/plan-week");
  const board = page.getByRole("region", {
    name: "Monday to Sunday household week",
  });
  const today = board.getByRole("article", { name: "Wed 9" });
  await expect(today).toHaveAttribute("aria-current", "date");
  const plans = today.getByRole("region", {
    name: "Plans on Wednesday, September 9",
  });
  await expect(
    plans.getByRole("link", { name: /Japan together/ }),
  ).toContainText("Continues");
  const routines = today.getByRole("region", {
    name: "Routines on Wednesday, September 9",
  });
  await expect(
    routines.getByRole("link", { name: /Take out recycling/ }),
  ).toContainText("Since Mon");
  await expect(
    routines.getByRole("button", { name: "Mark Take out recycling done" }),
  ).toBeEnabled();
  await expect(
    routines.getByRole("button", { name: "Empty dishwasher completed" }),
  ).toBeDisabled();
  await expect(
    today.getByRole("link", { name: /dinner on Wednesday, September 9/ }),
  ).toContainText("Rösti with fried eggs");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "output/playwright/plan-week-mobile.png",
    fullPage: true,
  });
});

test("a linked flight appears once with its Zurich time and future work waits", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/m7-fixture/plan-week");
  const tuesday = page.getByRole("article", { name: "Tue 8" });
  await expect(
    tuesday.getByText("Flight to Tokyo", { exact: true }),
  ).toHaveCount(1);
  const flight = tuesday.getByRole("link", { name: /Flight to Tokyo/ });
  await expect(flight).toContainText("09:00");
  await expect(
    tuesday.getByRole("link", { name: "Calendar event", exact: true }),
  ).toHaveAttribute(
    "href",
    `/plan/calendar/77000000-0000-4000-8000-000000000002`,
  );
  await expect(
    tuesday.getByRole("link", { name: /^Trip starts Japan together/ }),
  ).toBeVisible();
  const friday = page.getByRole("article", { name: "Fri 11" });
  await expect(
    friday.getByRole("button", { name: "Mark Water the balcony done" }),
  ).toBeDisabled();
  await expect(friday.getByRole("link", { name: /Dentist/ })).toContainText(
    "08:30",
  );
  await expect(
    page.getByRole("navigation", { name: "Plan sections" }).getByRole("link", {
      name: "Trips",
    }),
  ).toHaveAttribute("href", "/plan/trips");
  await expect(
    page.getByRole("link", { name: "Add event on Monday, September 7" }),
  ).toHaveAttribute("href", "/plan/calendar/new?date=2026-09-07");
});

test("meals stay usable when the week's plans cannot load", async ({
  page,
}) => {
  await page.goto("/m7-fixture/plan-week?unavailable=1");
  await expect(page.getByRole("status")).toContainText("couldn’t load");
  await expect(
    page.getByRole("button", { name: "Retry plans & routines" }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: /dinner on Wednesday, September 9/ }),
  ).toContainText("Rösti with fried eggs");
  await expect(page.getByText("Take out recycling")).toHaveCount(0);
});
