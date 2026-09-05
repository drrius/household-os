import { expect, test, type Page } from "@playwright/test";

const surfaces = [
  ["today", "Hoi Darius ☀"],
  ["plan", "10 – 16 Aug"],
  ["groceries", "Groceries"],
  ["money", "Money"],
  ["home", "Our home"],
] as const;

async function expectAccessibleStructure(page: Page, heading: string) {
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("heading", { level: 1, name: heading }),
  ).toHaveCount(1);

  const brokenLabels = await page
    .locator("section[aria-labelledby]")
    .evaluateAll((sections) =>
      sections
        .map((section) => section.getAttribute("aria-labelledby"))
        .filter((id) => id === null || document.getElementById(id) === null),
    );
  expect(brokenLabels).toEqual([]);
}

async function expectNoObviousLayoutFailure(page: Page) {
  const layout = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    shortTargets: Array.from(
      document.querySelectorAll<HTMLElement>(
        "a[href], button:not([disabled]), [role='button']:not([aria-disabled='true']), [role='checkbox']:not([aria-disabled='true'])",
      ),
    )
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);

        if (element.tagName === "A" && style.display === "inline") {
          return false;
        }

        return (
          rect.width > 0 &&
          rect.height > 0 &&
          rect.right > 0 &&
          rect.bottom > 0 &&
          rect.left < window.innerWidth &&
          rect.top < window.innerHeight &&
          (rect.width < 24 || rect.height < 24)
        );
      })
      .map(
        (element) =>
          element.getAttribute("aria-label") ?? element.textContent?.trim(),
      ),
  }));

  expect(layout.scrollWidth).toBeLessThanOrEqual(layout.clientWidth + 1);
  expect(layout.shortTargets).toEqual([]);
}

for (const [surface, heading] of surfaces) {
  test(`${surface} matches the M6 responsive and semantic shell`, async ({
    page,
  }) => {
    await page.goto(`/m6-fixture/${surface}`);

    await expect(page).toHaveTitle(/Household OS/);
    await expect(page.locator("body")).not.toBeEmpty();
    await expect(
      page.locator("nextjs-portal [data-next-badge][data-error='true']"),
    ).toHaveCount(0);
    await expectAccessibleStructure(page, heading);
    await expectNoObviousLayoutFailure(page);

    const fonts = await page.evaluate(() => ({
      body: getComputedStyle(document.body).fontFamily,
      heading: getComputedStyle(document.querySelector("h1")!).fontFamily,
    }));
    expect(fonts.body).toContain("Work Sans");
    expect(fonts.heading).toContain("Nunito");
  });
}

test("keyboard focus is visible and the global add dialog restores focus", async ({
  browserName,
  page,
}) => {
  await page.goto("/m6-fixture/today");

  const skipLink = page.getByRole("link", { name: "Skip to content" });
  if (browserName === "chromium") {
    await page.keyboard.press("Tab");
  } else {
    // Safari follows the macOS link-tabbing preference, which Playwright does
    // not control. Focus directly there while Chromium verifies tab order.
    await skipLink.focus();
  }
  await expect(skipLink).toBeFocused();
  const focusStyle = await skipLink.evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      outlineStyle: style.outlineStyle,
      outlineWidth: style.outlineWidth,
    };
  });
  expect(focusStyle.outlineStyle).not.toBe("none");
  expect(Number.parseFloat(focusStyle.outlineWidth)).toBeGreaterThan(0);

  const addButton = page.getByRole("button", { name: "Add something" });
  await addButton.focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("dialog", { name: "Add something" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: /Routine/ })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("dialog", { name: "Add something" }),
  ).toBeHidden();
  await expect(addButton).toBeFocused();
});

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

test("mobile Cmd+B does not open a duplicate sidebar", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/m6-fixture/home");

  await page.keyboard.press("Meta+b");

  await expect(page.locator('[data-mobile="true"]')).toHaveCount(0);
  await expect(
    page.getByRole("navigation", { name: "Primary navigation" }),
  ).toBeVisible();
});

test("reduced motion removes meaningful animation and transitions", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/m6-fixture/today");

  const durations = await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("link")
    .first()
    .evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        animationDuration: style.animationDuration,
        transitionDuration: style.transitionDuration,
      };
    });

  expect(Number.parseFloat(durations.animationDuration)).toBeLessThanOrEqual(
    0.01,
  );
  expect(Number.parseFloat(durations.transitionDuration)).toBeLessThanOrEqual(
    0.01,
  );
});

test("core light-theme token pairs meet WCAG AA text contrast", async ({
  page,
}) => {
  await page.goto("/m6-fixture/today");

  const contrasts = await page.evaluate(() => {
    // Resolve tokens through a canvas rather than parsing one colour syntax:
    // the CSS pipeline emits oklch() under webpack but downlevels it to hex
    // plus a lab() @supports block under Turbopack, and both must measure the
    // same. The canvas resolves whatever syntax the browser reports to sRGB.
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (context === null) throw new Error("Expected a 2D canvas context");

    const toLinear = (channel: number) => {
      const value = channel / 255;
      return value <= 0.04045
        ? value / 12.92
        : ((value + 0.055) / 1.055) ** 2.4;
    };

    const luminance = (value: string): number => {
      // An unparseable colour leaves fillStyle untouched, so probe from two
      // different sentinels and require them to agree.
      context.fillStyle = "#000000";
      context.fillStyle = value;
      const fromBlack = context.fillStyle;
      context.fillStyle = "#ffffff";
      context.fillStyle = value;
      if (context.fillStyle !== fromBlack)
        throw new Error(`Expected a resolvable colour, received ${value}`);

      context.clearRect(0, 0, 1, 1);
      context.fillRect(0, 0, 1, 1);
      // A 1x1 read always yields four channels; the defaults only satisfy
      // noUncheckedIndexedAccess.
      const [red = 0, green = 0, blue = 0] = context.getImageData(
        0,
        0,
        1,
        1,
      ).data;
      return (
        0.2126 * toLinear(red) +
        0.7152 * toLinear(green) +
        0.0722 * toLinear(blue)
      );
    };

    const root = getComputedStyle(document.documentElement);
    const ratio = (foreground: string, background: string) => {
      const foregroundLuminance = luminance(
        root.getPropertyValue(foreground).trim(),
      );
      const backgroundLuminance = luminance(
        root.getPropertyValue(background).trim(),
      );
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    };

    return {
      body: ratio("--foreground", "--background"),
      muted: ratio("--muted-foreground", "--background"),
      primary: ratio("--primary-foreground", "--primary"),
      secondary: ratio("--secondary-foreground", "--secondary"),
      success: ratio("--success", "--success-soft"),
      warning: ratio("--warning-foreground", "--warning-soft"),
    };
  });

  for (const ratio of Object.values(contrasts)) {
    expect(ratio).toBeGreaterThanOrEqual(4.5);
  }
});
