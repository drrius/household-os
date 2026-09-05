import { expect, test } from "@playwright/test";

for (const width of [390, 1280]) {
  test(`household search is reachable from the shell at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 720 });
    await page.goto("/m7-fixture/search");
    const search = page.getByRole("link", {
      name: "Search household",
      exact: true,
    });
    await expect(search).toBeInViewport();
    await search.click();
    // The real destination authenticates; the public fixture grants no session.
    await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
    await page.goBack();
    await expect(
      page.getByRole("heading", { name: "A few places to start" }),
    ).toBeVisible();
  });
}
