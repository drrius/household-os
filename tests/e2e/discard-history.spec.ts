import { expect, test } from "@playwright/test";

async function openFixture(page: import("@playwright/test").Page, query = "") {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
  await page.goto(`/m7-fixture/discard${query}`);
}

for (const [kind, label] of [
  ["expense", "Description"],
  ["routine", "Title"],
] as const) {
  test(`${kind} edits survive cancelled browser Back and Forward`, async ({
    page,
  }) => {
    await openFixture(page, "?destination=start");
    await page.getByRole("link", { name: `Edit ${kind}` }).click();
    const input = page.getByLabel(label, { exact: true });
    await input.fill("Keep my history edit");
    const original = page.url();
    const backDialog = page.waitForEvent("dialog");
    await page.evaluate(() => history.back());
    await (await backDialog).dismiss();
    await expect(page).toHaveURL(original);
    await expect(input).toHaveValue("Keep my history edit");
    const acceptedBack = page.waitForEvent("dialog");
    await page.evaluate(() => history.back());
    await (await acceptedBack).accept();
    await expect(page).toHaveURL(/destination=start/);
    await page.goForward();
    await expect(input).toBeVisible();
    await page.getByRole("link", { name: "Another page" }).click();
    await expect(page).toHaveURL(/destination=navigation/);
    await page.goBack();
    await input.fill("Keep the second edit");
    const forwardDialog = page.waitForEvent("dialog");
    await page.evaluate(() => history.forward());
    await (await forwardDialog).dismiss();
    await expect(page).toHaveURL(original);
    await expect(input).toHaveValue("Keep the second edit");
    const acceptedForward = page.waitForEvent("dialog");
    await page.evaluate(() => history.forward());
    await (await acceptedForward).accept();
    await expect(page).toHaveURL(/destination=navigation/);
  });
}
