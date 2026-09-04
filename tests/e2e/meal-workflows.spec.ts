import { expect, test } from "@playwright/test";

const mealId = "11111111-1111-4111-8111-111111111111";

test("meal details support cooking, moving and leftovers without entering edit mode", async ({
  page,
}) => {
  await page.goto("/m7-fixture/meals/details");
  await expect(
    page.getByRole("heading", { level: 1, name: "Tomato pasta" }),
  ).toBeVisible();
  await expect(
    page.getByText("Keep some sauce for lunch.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Open recipe" })).toHaveAttribute(
    "href",
    "https://example.com/recipe",
  );
  await expect(page.getByRole("link", { name: "Open recipe" })).toHaveAttribute(
    "target",
    "_blank",
  );
  await expect(page.getByRole("textbox")).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Move meal" })).toHaveAttribute(
    "href",
    `/plan/meals/${mealId}/move?day=2026-09-10`,
  );
  await expect(
    page.getByRole("link", { name: "Plan leftovers" }),
  ).toHaveAttribute(
    "href",
    `/plan/meals/new?leftoverOf=${mealId}&date=2026-09-11&slot=dinner`,
  );
  await expect(
    page.getByRole("link", { name: "Back to plan" }),
  ).toHaveAttribute("href", "/plan?week=2026-09-07&day=2026-09-10");
  await expect(
    page.getByRole("heading", { name: "Make the sauce" }),
  ).toBeVisible();
  await expect(page.getByText("Tomatoes", { exact: true })).toBeVisible();
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    client: document.documentElement.clientWidth,
  }));
  expect(sizes.scroll).toBeLessThanOrEqual(sizes.client + 1);
});

test("planning restores the selected day and finds saved meals", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/meals/plan");
  await expect(
    page.getByRole("heading", { name: "Ideas for this week" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Pizza night" }),
  ).toBeVisible();
  if (testInfo.project.name === "mobile-safari")
    await expect(
      page.getByRole("button", { name: "Thu 10", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
  const search = page.getByRole("searchbox", { name: "Find a saved meal" });
  await search.fill("risotto");
  await expect(
    page.getByRole("link", { name: "Plan Risotto", exact: true }),
  ).toHaveAttribute(
    "href",
    "/plan/meals/new?libraryId=saved-4&date=2026-09-10&slot=dinner",
  );
  await expect(
    page.getByRole("link", { name: "Plan Tomato pasta", exact: true }),
  ).toHaveCount(0);
  await search.fill("nothing-matches");
  await expect(
    page.getByText("No saved meals match. Try another name."),
  ).toBeVisible();
});

test("a weekly idea has an explicit date and safe cancel destination", async ({
  page,
}) => {
  await page.goto("/m7-fixture/meals/new");
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true }),
  ).toHaveAttribute("href", "/plan?week=2026-09-07&day=2026-09-10");
  await expect(page.getByRole("combobox", { name: "Meal time" })).toContainText(
    "Decide later",
  );
  await expect(page.locator('input[name="date"]')).toHaveValue("2026-09-10");
});

test("meal board content is visible before JavaScript hydrates", async ({
  browser,
}) => {
  const context = await browser.newContext({
    javaScriptEnabled: false,
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();
  await page.goto(
    `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3000"}/m7-fixture/meals/plan`,
  );
  await expect(
    page.getByRole("heading", { name: "Tomato pasta", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "Add breakfast on Monday, September 7",
      exact: true,
    }),
  ).toBeVisible();
  await context.close();
});
