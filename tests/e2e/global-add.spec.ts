import { expect, test } from "@playwright/test";

test("all global creation actions remain reachable on a short phone screen", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 568 });
  await page.goto("/m6-fixture/today");
  const trigger = page.getByRole("button", { name: "Add something" });
  await trigger.click();
  const dialog = page.getByRole("dialog", { name: "Add something" });
  for (const name of [/^Trip/, /^Project/]) {
    const action = dialog.getByRole("link", { name });
    await action.scrollIntoViewIfNeeded();
    await expect(action).toBeInViewport();
  }
  const cancel = dialog.getByRole("button", { name: "Cancel" });
  await cancel.scrollIntoViewIfNeeded();
  await expect(cancel).toBeInViewport();
  await cancel.click();
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});
