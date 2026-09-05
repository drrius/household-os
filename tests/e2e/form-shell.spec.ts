import { expect, test, type Page } from "@playwright/test";

async function healthyFixture(page: Page) {
  await expect(page).toHaveTitle(/Household OS/);
  await expect(
    page.getByRole("heading", { name: "Form and shell fixture" }),
  ).toBeVisible();
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.locator("nextjs-portal [data-next-badge][data-error='true']"),
  ).toHaveCount(0);
}

test("skip link stays offscreen until keyboard focus and transfers focus to main", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  await page.goto("/m7-fixture/form-shell");
  await healthyFixture(page);
  const skip = page.getByRole("link", { name: "Skip to content" });
  await expect(skip).not.toBeInViewport();
  await expect(skip).not.toBeFocused();
  expect(
    await skip.evaluate((link) => link.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `/tmp/form-shell-${testInfo.project.name}-initial.png`,
  });
  await page.keyboard.press("Tab");
  await expect(skip).toBeFocused();
  await expect(skip).toBeInViewport();
  await page.screenshot({
    path: `/tmp/form-shell-${testInfo.project.name}-focused.png`,
  });
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(skip).not.toBeInViewport();
  await page.evaluate(() => window.scrollTo(0, 650));
  await expect(skip).not.toBeInViewport();
  expect(
    await skip.evaluate((link) => link.getBoundingClientRect().bottom),
  ).toBeLessThanOrEqual(0);
  await page.screenshot({
    path: `/tmp/form-shell-${testInfo.project.name}-scrolled-viewport.png`,
    fullPage: false,
  });
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});

test("form page keeps Cancel by default and supports an explicit detail back label", async ({
  page,
}) => {
  await page.goto("/m7-fixture/form-shell");
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true }),
  ).toBeVisible();
  await page.goto("/m7-fixture/form-shell?control=detail");
  await expect(
    page.getByRole("link", { name: "Cancel", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("link", { name: "Back to Home", exact: true }).click();
  await expect(page).toHaveURL(/\/m7-fixture\/form-shell$/);
});

test("an authentication-style redirect inside a form command navigates instead of showing NEXT_REDIRECT", async ({
  page,
}) => {
  await page.goto("/m7-fixture/form-shell?control=redirect");
  await page.getByRole("button", { name: "Save fixture" }).click();
  await expect(page).toHaveURL(/destination=sign-in/);
  await expect(
    page.getByRole("heading", { name: "Sign-in destination" }),
  ).toBeVisible();
  await expect(page.getByText("NEXT_REDIRECT", { exact: true })).toHaveCount(0);
});

test("notFound inside a form command reaches the route boundary", async ({
  page,
}) => {
  await page.goto("/m7-fixture/form-shell?control=missing");
  await page.getByRole("button", { name: "Save fixture" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture record not found" }),
  ).toBeVisible();
  await expect(page.getByText(/NEXT_HTTP_ERROR_FALLBACK/)).toHaveCount(0);
});

test("ordinary errors retain the form and focus its error message", async ({
  page,
}) => {
  await page.goto("/m7-fixture/form-shell");
  await page
    .getByRole("textbox", { name: "Household note" })
    .fill("Keep my edits");
  await page.getByRole("button", { name: "Save fixture" }).click();
  const error = page.getByRole("main").getByRole("alert");
  await expect(error).toContainText(
    "Fixture could not save. Your input is safe.",
  );
  await expect(
    page.getByRole("textbox", { name: "Household note" }),
  ).toHaveValue("Keep my edits");
  expect(
    await error.evaluate((element) =>
      document.activeElement?.contains(element),
    ),
  ).toBe(true);
  await expect(
    page.getByRole("link", { name: "Skip to content" }),
  ).not.toBeInViewport();
});
