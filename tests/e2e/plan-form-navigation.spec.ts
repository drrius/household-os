import { expect, test } from "@playwright/test";

const cases = [
  ["project", "/m7-fixture/projects/create/project", "Project name"],
  ["task", "/m7-fixture/projects/create/task", "What needs doing?"],
  ["booking", "/m7-fixture/trips", "Booking name"],
  ["event", "/m7-fixture/calendar", "Title"],
] as const;

for (const [kind, path, label] of cases) {
  test(`${kind} retains unsaved changes when leaving is cancelled`, async ({
    page,
  }) => {
    await page.goto(path);
    const field = page.getByLabel(label, { exact: true });
    await field.fill("Keep this unfinished plan");
    const original = page.url();
    page.once("dialog", (dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    await expect(page).toHaveURL(original);
    await expect(field).toHaveValue("Keep this unfinished plan");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    await expect(page).not.toHaveURL(original);
  });
}
