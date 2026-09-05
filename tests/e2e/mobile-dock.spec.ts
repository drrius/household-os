import { expect, test, type Page } from "@playwright/test";

async function expectDockAtBottom(page: Page) {
  const dock = page.getByRole("navigation", { name: "Primary navigation" });
  await expect(dock).toBeVisible();
  await expect
    .poll(() =>
      dock.evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const inset = Number.parseFloat(getComputedStyle(element).bottom);
        return Math.abs(rect.bottom + inset - window.innerHeight);
      }),
    )
    .toBeLessThanOrEqual(1);
  const assistant = page.getByRole("button", { name: "Open the assistant" });
  await expect(assistant).toBeInViewport();
  const dockBox = await dock.boundingBox();
  const assistantBox = await assistant.boundingBox();
  expect(dockBox).not.toBeNull();
  expect(assistantBox).not.toBeNull();
  expect(assistantBox!.y + assistantBox!.height).toBeLessThan(dockBox!.y);
}

test("mobile dock stays at the viewport bottom through long-form scrolling, focus and resizing", async ({
  page,
}, testInfo) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m7-fixture/home-records/commitments");
  await expect(page).toHaveTitle(/Household OS/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Add or edit commitments",
  );
  await expectDockAtBottom(page);

  const notice = page.getByLabel("Notice period in days");
  await notice.scrollIntoViewIfNeeded();
  // The transparent viewport frame must allow taps through to the form.
  await notice.click();
  await expect(notice).toBeFocused();
  await expectDockAtBottom(page);
  // Browser automation cannot open the native iOS keyboard. Exercise viewport
  // changes and focus/blur separately; physical iOS remains a manual check.
  await page.setViewportSize({ width: 390, height: 520 });
  await expectDockAtBottom(page);
  await notice.blur();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expectDockAtBottom(page);
  await expect(
    page.getByRole("button", { name: "Add commitment", exact: true }),
  ).toBeInViewport();
  await page.screenshot({
    path: `/tmp/mobile-dock-${testInfo.project.name}.png`,
  });

  await page.setViewportSize({ width: 844, height: 390 });
  await expectDockAtBottom(page);
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect(page.locator('[data-slot="sidebar-container"]')).toBeVisible();
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toHaveCount(1);
  expect(errors).toEqual([]);
});

test("mobile floating controls remain clickable above the page", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m6-fixture/today");
  await page.getByRole("button", { name: "Add something" }).click();
  await expect(
    page.getByRole("dialog", { name: "Add something" }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Add something" }),
  ).toBeHidden();
  await expectDockAtBottom(page);
  await page.getByRole("button", { name: "Open the assistant" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
});
