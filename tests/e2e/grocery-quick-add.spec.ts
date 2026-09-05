import { expect, test } from "@playwright/test";
test("quick add retains the failed name and focus before the next item", async ({
  page,
}) => {
  await page.goto("/m7-fixture/grocery-quick-add");
  const input = page.getByRole("textbox", { name: "Add grocery item" });
  await input.fill("Milk");
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await expect(input).not.toBeEditable();
  await input.focus();
  await page.keyboard.press("End");
  await page.keyboard.type("Bread");
  await expect(input).toHaveValue("Milk");
  await page.getByRole("button", { name: "Fail pending request" }).click();
  await expect(
    page.getByText("Could not add this item. Try again."),
  ).toBeVisible();
  await expect(input).toHaveValue("Milk");
  await expect(input).toBeEditable();
  await expect(input).toBeFocused();
  await page.getByRole("button", { name: "Add item", exact: true }).click();
  await page.getByRole("button", { name: "Complete pending request" }).click();
  await expect(page.getByText("Saved Milk")).toBeVisible();
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  await input.fill("Bread");
  await expect(input).toHaveValue("Bread");
});
