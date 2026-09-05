import { expect, test } from "@playwright/test";

test("search filters and cursor survive record edit, reload and save without leaking to another record", async ({
  page,
}) => {
  const id = "77000000-0000-4000-8000-000000000001";
  const context = `/search?q=Lisbon&type=trip&archived=1&cursor=100.booking.${id}`;
  const record = `/m7-fixture/search-origin/${id}`;
  await page.goto(`${record}?${new URLSearchParams({ fromSearch: context })}`);
  await page.getByRole("link", { name: "Edit record", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`/edit\\?fromSearch=`));
  expect(new URL(page.url()).searchParams.get("fromSearch")).toBe(context);
  await page.reload();
  await page.getByLabel("Record title").fill("Changed booking");
  await page.getByRole("button", { name: "Save fixture record" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture record", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to search results" }),
  ).toHaveAttribute("href", context);
  await expect(page).toHaveURL(new RegExp(`${id}\\?fromSearch=`));
  await page.getByRole("link", { name: "Open unrelated record" }).click();
  await expect(page).toHaveURL(/000000000002$/);
  await expect(
    page.getByRole("link", { name: "Back to search results" }),
  ).toHaveCount(0);
});

test("saving back to a list keeps the original search return link", async ({
  page,
  request,
}) => {
  // Compile the destination before interaction: the dev server can otherwise
  // spend the assertion window compiling this first visit on a cold CI worker.
  expect((await request.get("/m7-fixture/search-origin")).ok()).toBe(true);
  const context = "/search?q=passport&type=task&archived=1";
  await page.goto(
    `/m7-fixture/search-origin/77000000-0000-4000-8000-000000000001?${new URLSearchParams({ fromSearch: context })}`,
  );
  await page.getByRole("link", { name: "Edit record", exact: true }).click();
  await expect(page.locator('[name="searchReturn"]')).toHaveValue(context);
  await page.getByLabel("Record title").fill("Pack passports");
  await page.getByRole("button", { name: "Save and return to list" }).click();
  await expect(
    page.getByRole("heading", { name: "Fixture record list" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to search results" }),
  ).toHaveAttribute("href", context);
  expect(new URL(page.url()).searchParams.get("fromSearch")).toBe(context);
});
