import { expect, test, type Page } from "@playwright/test";

const surfaces = [
  ["today", "Hoi Darius ☀"],
  ["plan", "This week"],
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
    function luminance(value: string): number {
      const match = value.match(
        /oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*[\d.]+%?)?\s*\)/,
      );
      if (match === null)
        throw new Error(`Expected OKLCH token, received ${value}`);
      const lightness = Number(match[1]);
      const chroma = Number(match[2]);
      const hue = (Number(match[3]) * Math.PI) / 180;
      const a = chroma * Math.cos(hue);
      const b = chroma * Math.sin(hue);
      const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
      const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
      const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;
      const l = lPrime ** 3;
      const m = mPrime ** 3;
      const s = sPrime ** 3;
      const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
      const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
      const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
      return (
        0.2126 * Math.min(1, Math.max(0, red)) +
        0.7152 * Math.min(1, Math.max(0, green)) +
        0.0722 * Math.min(1, Math.max(0, blue))
      );
    }

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
