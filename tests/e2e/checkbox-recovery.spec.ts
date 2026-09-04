import { expect, test } from "@playwright/test";

test("an unchecked default survives a rejected category restore", async ({
  page,
}) => {
  await page.goto("/m7-fixture/checkbox-recovery");
  await page.getByText("Archived category · Archived", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Name", exact: true })
    .fill("Restored category");
  const archive = page.getByRole("checkbox", {
    name: "Keep category archived",
  });
  await expect(archive).toBeChecked();
  await archive.uncheck();
  await page.getByRole("button", { name: "Save category" }).click();
  await expect(
    page.getByText("The category changed. Try again."),
  ).toBeVisible();
  await expect(archive).not.toBeChecked();
  await expect(
    page.getByRole("textbox", { name: "Name", exact: true }),
  ).toHaveValue("Restored category");
});
