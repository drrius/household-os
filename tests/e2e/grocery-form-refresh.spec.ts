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

test("renamed fallback is a single category choice", async ({ page }) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page.getByRole("region", { name: "Item editor" });
  await expect(editor.getByRole("combobox")).toContainText("Unsorted");
  await editor.getByRole("combobox").click();
  await expect(
    page.getByRole("option", { name: "Unsorted", exact: true }),
  ).toHaveCount(1);
  await expect(
    page.getByRole("option", { name: "Other", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("option", { name: "Produce", exact: true }).click();
  await expect(editor.locator('[name="categoryId"]')).toHaveValue("produce");
});

test("an archived fallback and its active namesake remain distinguishable", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  await page
    .getByRole("button", { name: "Simulate archived fallback" })
    .click();
  const editor = page.getByRole("region", { name: "Item editor" });
  await expect(editor.getByRole("combobox")).toContainText(
    "Other (unassigned)",
  );
  await editor.getByRole("combobox").click();
  await expect(
    page.getByRole("option", { name: "Other (unassigned)", exact: true }),
  ).toHaveCount(1);
  await page.getByRole("option", { name: "Other", exact: true }).click();
  await expect(editor.locator('[name="categoryId"]')).toHaveValue("custom");
});

test("pristine category editors accept refreshed name, order and archived state", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  const editor = page
    .getByRole("region", { name: "Category editor" })
    .locator("details")
    .first();
  await expect(editor.locator("summary")).toContainText("Produce 2 · Archived");
  await editor.locator("summary").click();
  await expect(editor.locator('[name="name"]')).toHaveValue("Produce 2");
  await expect(editor.locator('[name="sortOrder"]')).toHaveValue("2");
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 2",
  );
  await expect(editor.getByRole("checkbox")).toBeChecked();
  await editor.getByRole("button", { name: "Save category" }).click();
  await expect(editor.getByText("Snapshot accepted")).toBeVisible();
});
test("reverting category edits adopts a waiting partner refresh", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page
    .getByRole("region", { name: "Category editor" })
    .locator("details")
    .first();
  await editor.locator("summary").click();
  await editor.locator('[name="name"]').fill("My change");
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 1",
  );
  await editor.locator('[name="name"]').fill("Produce 1");
  await expect(editor.locator('[name="name"]')).toHaveValue("Produce 2");
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 2",
  );
});
test("archive-only edits keep their original conflict baseline", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-form-refresh");
  const editor = page
    .getByRole("region", { name: "Category editor" })
    .locator("details")
    .first();
  await editor.locator("summary").click();
  await editor.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Simulate partner refresh" }).click();
  await expect(editor.locator('[name="previousName"]')).toHaveValue(
    "Produce 1",
  );
  await expect(editor.locator('[name="previousArchivedAt"]')).toHaveValue("");
  await expect(editor.getByRole("checkbox")).toBeChecked();
});
