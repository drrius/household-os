import { expect, test } from "@playwright/test";

test("desktop shadcn sidebar keeps the global add action in view", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto("/m6-fixture/home");

  const sidebar = page.locator('[data-slot="sidebar-container"]');
  const addButton = page.getByRole("button", { name: "Add something" });
  const toggle = page.locator('[data-sidebar="trigger"]');
  const desktopSidebar = page.locator('[data-slot="sidebar"][data-state]');

  await expect(sidebar).toBeVisible();
  await expect(addButton).toBeVisible();
  await expect(sidebar).toHaveCSS("position", "fixed");
  await expect(
    sidebar.getByRole("link", { name: "Home", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await expect(addButton).toHaveCSS("height", "36px");
  const addButtonCenterDelta = await addButton.evaluate((element) => {
    const icon = element.querySelector("svg");
    const label = element.querySelector("span");
    if (icon === null || label === null) {
      throw new Error("Expected the Add button icon and label");
    }

    const buttonRect = element.getBoundingClientRect();
    const iconRect = icon.getBoundingClientRect();
    const labelRect = label.getBoundingClientRect();
    const contentLeft = Math.min(iconRect.left, labelRect.left);
    const contentRight = Math.max(iconRect.right, labelRect.right);
    const buttonCenter = buttonRect.left + buttonRect.width / 2;
    const contentCenter = contentLeft + (contentRight - contentLeft) / 2;
    return Math.abs(buttonCenter - contentCenter);
  });
  expect(addButtonCenterDelta).toBeLessThanOrEqual(2);

  const navigationLinks = sidebar
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link");
  await expect(navigationLinks).toHaveText([
    "Today",
    "Plan",
    "Groceries",
    "Money",
    "Home",
    "Search household",
  ]);
  const navigationRects = await navigationLinks.evaluateAll((links) =>
    links.map((link) => {
      const rect = link.getBoundingClientRect();
      return { bottom: rect.bottom, height: rect.height, top: rect.top };
    }),
  );
  expect(navigationRects.every(({ height }) => height <= 36)).toBe(true);
  expect(
    navigationRects.slice(1).every(({ top }, index) => {
      const previous = navigationRects[index];
      return previous !== undefined && top - previous.bottom <= 4;
    }),
  ).toBe(true);

  const initialButtonTop = await addButton.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));

  await expect(addButton).toBeInViewport();
  await expect
    .poll(() =>
      addButton.evaluate((element) => element.getBoundingClientRect().top),
    )
    .toBe(initialButtonTop);

  await toggle.focus();
  await toggle.press("Enter");
  await expect(desktopSidebar).toHaveAttribute("data-state", "collapsed");
  await expect(toggle).toBeVisible();
  await expect(toggle).toBeFocused();
  await expect(addButton).toBeInViewport();

  await expect(addButton.locator("span")).toBeHidden();
  await expect
    .poll(() =>
      addButton.evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBe(32);

  const collapsedIsContained = await page.evaluate(() => {
    const sidebarElement = document.querySelector<HTMLElement>(
      '[data-slot="sidebar-container"]',
    );
    const addElement = document.querySelector<HTMLElement>(
      '[data-sidebar="footer"] button',
    );
    if (sidebarElement === null || addElement === null) {
      throw new Error("Expected the collapsed sidebar controls");
    }

    const sidebarRect = sidebarElement.getBoundingClientRect();
    const addRect = addElement.getBoundingClientRect();
    return (
      addRect.left >= sidebarRect.left && addRect.right <= sidebarRect.right
    );
  });
  expect(collapsedIsContained).toBe(true);
});
