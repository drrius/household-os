import { expect, test } from "@playwright/test";
test("grocery item refresh preserves dirty fields and the original CAS token", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page.getByRole("region", { name: "Item editor" });
  await editor.locator('[name="name"]').fill("My apples");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="name"]')).toHaveValue("My apples");
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v1");
  await editor.getByRole("button", { name: "Save item" }).click();
  await expect(
    editor.getByText("Partner changed this record. Reopen it before saving."),
  ).toBeVisible();
  await expect(editor.locator('[name="name"]')).toHaveValue("My apples");
  await page.getByRole("button", { name: "Open another record" }).click();
  await expect(editor.locator('[name="name"]')).toHaveValue("Apples 2");
  await expect(editor.locator('[name="updatedAt"]')).toHaveValue("v2");
});
test("category refresh keeps all baseline fields paired with dirty edits", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page
    .getByRole("region", { name: "Category editor" })
    .locator("details")
    .first();
  await editor.locator("summary").click();
  await editor.locator('[name="name"]').fill("My produce");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 1",
  );
  await expect(editor.locator('[name="previousSortOrder"]')).toHaveValue("1");
  await expect(editor.locator('[name="previousArchivedAt"]')).toHaveValue("");
  await editor.getByRole("button", { name: "Save category" }).click();
  await expect(
    editor.getByText("Partner changed this record. Reopen it before saving."),
  ).toBeVisible();
  await expect(editor.locator('[name="name"]')).toHaveValue("My produce");
  await page.getByRole("button", { name: "Open another record" }).click();
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 2",
  );
  await expect(editor.locator('[name="name"]')).toHaveValue("Produce 2");
});

test("a fresh categories navigation starts a new baseline after editing", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page
    .getByRole("region", { name: "Category editor" })
    .locator("details")
    .first();
  await editor.locator("summary").click();
  await editor.locator('[name="name"]').fill("Earlier draft");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await page
    .getByRole("button", { name: "Finish and reopen this page" })
    .click();
  await expect(editor.locator('[name="name"]')).toHaveValue("Produce 1");
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 1",
  );
});
