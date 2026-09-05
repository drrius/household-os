import { expect, test } from "@playwright/test";

test("Home exposes every household collection with comfortable links", async ({
  page,
}, info) => {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
  await page.goto("/m6-fixture/home");
  const navigation = page.getByRole("navigation", {
    name: "Household records",
  });
  await expect(navigation.getByRole("link")).toHaveCount(5);
  for (const [title, destination] of [
    ["Inventory", "inventory"],
    ["Commitments", "commitments"],
    ["Decisions", "decisions"],
    ["Documents", "documents"],
    ["Contacts", "contacts"],
  ]) {
    const link = navigation.getByRole("link", {
      name: new RegExp(`^${title}`),
    });
    await expect(link).toHaveAttribute("href", `/home/${destination}`);
    const box = await link.boundingBox();
    expect(box?.height).toBeGreaterThanOrEqual(44);
    expect(box?.width).toBeGreaterThanOrEqual(44);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await navigation.getByRole("link").first().focus();
  await expect(navigation.getByRole("link").first()).toBeFocused();
  await page.screenshot({ path: info.outputPath("home-collections.png") });
});
