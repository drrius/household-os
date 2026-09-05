import { expect, test } from "@playwright/test";
test("pristine default groceries adopt the latest name and edit version", async ({
  page,
}) => {
  await page.goto("/m7-fixture/library-refresh");
  const editor = page.getByRole("region", { name: "Existing default grocery" });
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="name"]')).toHaveValue("Tomatoes 2");
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:02Z",
  );
});
test("dirty default groceries keep their version through a stale rejection and accept refresh after reverting", async ({
  page,
}) => {
  await page.goto("/m7-fixture/library-refresh");
  const editor = page.getByRole("region", { name: "Existing default grocery" });
  await editor.locator('[name="quantity"]').fill("3");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await editor.getByRole("button", { name: "Save grocery" }).click();
  await expect(
    editor.getByText("Partner changed this meal. Reload before saving."),
  ).toBeVisible();
  await expect(editor.locator('[name="quantity"]')).toHaveValue("3");
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:01Z",
  );
  await editor.locator('[name="quantity"]').fill("2");
  await expect(editor.locator('[name="name"]')).toHaveValue("Tomatoes 2");
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:02Z",
  );
});
test("category-only template edits retain the matching option labels", async ({
  page,
}) => {
  await page.goto("/m7-fixture/library-refresh");
  const editor = page.getByRole("region", { name: "Existing default grocery" });
  await editor.getByRole("combobox").click();
  await page.getByRole("option", { name: "Dairy", exact: true }).click();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="categoryId"]')).toHaveValue("dairy");
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:01Z",
  );
  await editor.getByRole("combobox").click();
  await page.getByRole("option", { name: "Produce 1", exact: true }).click();
  await expect(editor.locator('[name="version"]')).toHaveValue(
    "2026-09-05T00:00:02Z",
  );
  await expect(editor.getByRole("combobox")).toContainText("Produce 2");
});
