import { expect, test } from "@playwright/test";
test("search filters shared plans and opens the exact booking", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/search");
  await expect(
    page.getByRole("heading", { name: "A few places to start" }),
  ).toBeVisible();
  await page.getByLabel("What are you looking for?").fill("Lisbon");
  await page.getByLabel("Search in", { exact: true }).selectOption("trip");
  await page.getByLabel("What are you looking for?").press("Enter");
  await expect(page.getByRole("status")).toHaveText("3 matches");
  const bookingHref = await page
    .getByRole("link", { name: /Lisbon flight Zurich/ })
    .getAttribute("href");
  const bookingUrl = new URL(bookingHref!, page.url());
  expect(bookingUrl.pathname).toBe(
    "/plan/projects/00000000-0000-4000-8000-000000000001/bookings/00000000-0000-4000-8000-000000000002",
  );
  expect(bookingUrl.searchParams.get("fromSearch")).toBe(
    "/search?q=Lisbon&type=trip",
  );
  await expect(
    page.getByRole("heading", { name: "Lisbon flight payment" }),
  ).toHaveCount(0);
  await page.getByLabel("Include archived and finished").check();
  await page.getByLabel("What are you looking for?").press("Enter");
  await expect(page.getByRole("status")).toHaveText("4 matches");
  await expect(
    page.getByRole("heading", { name: "Lisbon last summer" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("household-search.png"),
    fullPage: true,
    caret: "initial",
  });
});
test("result pages preserve query, category and history filters", async ({
  page,
}) => {
  await page.goto("/m7-fixture/search?q=Warranty&type=asset&archived=1");
  await expect(page.getByRole("status")).toHaveText("32 matches");
  await expect(
    page.getByRole("list", { name: "Search results" }).getByRole("listitem"),
  ).toHaveCount(25);
  await page.getByRole("link", { name: "More results" }).click();
  await expect(page).toHaveURL(/cursor=100.asset/u, { timeout: 15000 });
  await expect(
    page.getByRole("list", { name: "Search results" }).getByRole("listitem"),
  ).toHaveCount(7);
  await expect(page.getByLabel("What are you looking for?")).toHaveValue(
    "Warranty",
  );
  await expect(page.getByLabel("Search in", { exact: true })).toHaveValue(
    "asset",
  );
  await expect(page.getByLabel("Include archived and finished")).toBeChecked();
  await page.getByRole("link", { name: "Back to first page" }).click();
  await expect(
    page.getByRole("heading", { name: "Warranty record 01" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Clear search" }).click();
  await expect(
    page.getByRole("heading", { name: "A few places to start" }),
  ).toBeVisible();
  await expect(page.getByLabel("What are you looking for?")).toHaveValue("");
});
test("empty and invalid queries have clear recovery and notes render as text", async ({
  page,
}) => {
  await page.goto("/m7-fixture/search?q=NoMatch");
  await expect(
    page.getByRole("heading", { name: "Nothing found yet" }),
  ).toBeVisible();
  await page.goto("/m7-fixture/search?q=Lisbon&cursor=broken");
  await expect(
    page.getByRole("alert").filter({ hasText: "result page" }),
  ).toContainText("Search again");
  await page.getByLabel("What are you looking for?").press("Enter");
  await expect(page.getByRole("status")).toHaveText("4 matches");
  await page.goto("/m7-fixture/search?q=Home&type=contact");
  await expect(page.getByText(/Our plumber’s number/)).toContainText(
    "<img src=x onerror=alert(1)>",
  );
  await expect(
    page.getByRole("list", { name: "Search results" }).locator("img"),
  ).toHaveCount(0);
});

test("valid Unicode titles and excerpts render without breaking the result page", async ({
  page,
}, testInfo) => {
  await page.goto("/m7-fixture/search?q=Emoji&type=document");
  await expect(page.getByRole("status")).toHaveText("1 match");
  await expect(page.getByRole("heading", { name: /^Emoji /u })).toHaveText(
    "Emoji " + "😀".repeat(194),
  );
  await expect(
    page.getByText("Pack " + "🧳".repeat(235), { exact: true }),
  ).toHaveCount(1);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("search-unicode.png"),
    fullPage: true,
    caret: "initial",
  });
});

test("Unicode query limits agree between input and server validation", async ({
  page,
}) => {
  await page.goto("/m7-fixture/search");
  const input = page.getByLabel("What are you looking for?");
  await input.fill("😀".repeat(120));
  expect(
    await input.evaluate((node: HTMLInputElement) => node.checkValidity()),
  ).toBe(true);
  await input.press("Enter");
  await expect(input).toHaveValue("😀".repeat(120));
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  await input.fill("😀".repeat(121));
  expect(
    await input.evaluate((node: HTMLInputElement) => node.checkValidity()),
  ).toBe(false);
  await page.goto("/m7-fixture/search?q=" + encodeURIComponent("😀"));
  await expect(
    page.getByRole("heading", { name: "Nothing found yet" }),
  ).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Add one more character" }),
  ).toBeVisible();
  await page.goto(
    "/m7-fixture/search?q=" + encodeURIComponent("😀".repeat(121)),
  );
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "120 characters",
  );
});

test("record return links preserve search pagination through reload and authentication", async ({
  page,
}) => {
  await page.goto("/m7-fixture/search?q=Warranty&type=asset&archived=1");
  await page.getByRole("link", { name: "More results" }).click();
  await expect(page).toHaveURL(/cursor=100.asset/u);
  await expect(
    page.getByRole("list", { name: "Search results" }).getByRole("listitem"),
  ).toHaveCount(7);
  const result = page
    .getByRole("list", { name: "Search results" })
    .getByRole("link")
    .first();
  const destination = new URL((await result.getAttribute("href"))!, page.url());
  const context = destination.searchParams.get("fromSearch")!;
  expect(context).toContain("cursor=");
  expect(context).toContain("archived=1");
  await page.goto(
    `/m7-fixture/plan-resources?fromSearch=${encodeURIComponent(context)}`,
  );
  await page.reload();
  const back = page.getByRole("link", {
    name: "Back to search results",
    exact: true,
  });
  await expect(back).toHaveAttribute("href", context);
  await back.click();
  await expect(page).toHaveURL(/sign-in/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(context);
});
