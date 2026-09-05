import { expect, test } from "@playwright/test";

test("untouched grocery items accept partner values and their matching version", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page.getByRole("region", { name: "Item editor" });
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="name"]')).toHaveValue("Apples 2");
  await expect(editor.locator('[name="note"]')).toHaveValue("Note 2");
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v2");
  await editor.getByRole("button", { name: "Save item" }).click();
  await expect(editor.getByText("Snapshot accepted")).toBeVisible();
});

test("reverting item edits adopts the waiting partner update", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page.getByRole("region", { name: "Item editor" });
  await editor.locator('[name="quantity"]').fill("3");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v1");
  await editor.locator('[name="quantity"]').fill("2");
  await expect(editor.locator('[name="name"]')).toHaveValue("Apples 2");
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v2");
});

test("category-only edits freeze the baseline and can be reverted", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page.getByRole("region", { name: "Item editor" });
  await editor.getByRole("combobox").click();
  await page.getByRole("option", { name: "Produce", exact: true }).click();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="categoryId"]')).toHaveValue("produce");
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v1");
  await editor.getByRole("combobox").click();
  await page.getByRole("option", { name: "Unsorted", exact: true }).click();
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v2");
  await expect(editor.locator('[name="name"]')).toHaveValue("Apples 2");
});
