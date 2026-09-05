import { expect, test } from "@playwright/test";

test("an uncertain create followed by changed details preserves input and recovers through the existing record", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
  await page.goto("/m7-fixture/home-records/inventory?uncertain=1");
  const title = page.getByLabel("Item", { exact: true });
  const notes = page.getByLabel("Care instructions & notes");
  await title.fill("Dishwasher A");
  await notes.fill("Original care instructions");
  const id = await page.locator('input[name="id"]').inputValue();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText(/connection was interrupted/)).toBeVisible();
  await title.fill("Dishwasher B");
  await notes.fill("Updated care instructions");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText(/Your changes were not saved/)).toBeVisible();
  await expect(title).toHaveValue("Dishwasher B");
  await expect(notes).toHaveValue("Updated care instructions");
  await expect(page.locator('input[name="id"]')).toHaveValue(id);
  await expect(page.getByText("Saved record", { exact: true })).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("saved")).toBe(false);
  await page
    .getByRole("link", { name: "Cancel and open existing records" })
    .click();
  await expect(
    page.getByRole("heading", { name: "Dishwasher A", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("Original care instructions", { exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit details" }).click();
  await title.fill("Dishwasher B");
  await page.getByRole("button", { name: "Save changes", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Dishwasher B", exact: true }),
  ).toBeVisible();
});

test("an unchanged retry acknowledges the original create without another record", async ({
  page,
}) => {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
  await page.goto("/m7-fixture/home-records/inventory?uncertain=1");
  await page.getByLabel("Item", { exact: true }).fill("Dishwasher");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText(/connection was interrupted/)).toBeVisible();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(page.getByText("Saved record", { exact: true })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Dishwasher", exact: true }),
  ).toBeVisible();
});
