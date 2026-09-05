import { expect, test } from "@playwright/test";

for (const kind of ["project", "trip", "task"] as const) {
  test(`${kind} creation keeps its identity after rejection and hard reload, then starts a distinct operation`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/projects/create/${kind}`);
    await expect(page).toHaveURL(/\?draft=[0-9a-f-]{36}$/);
    const id = await page.locator('[name="id"]').inputValue();
    const title = page.getByLabel(
      kind === "task"
        ? "What needs doing?"
        : kind === "trip"
          ? "Trip name"
          : "Project name",
      { exact: true },
    );
    const label =
      kind === "task"
        ? "Add task"
        : kind === "trip"
          ? "Create trip"
          : "Create project";
    await title.fill("A shared plan");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByText(
        `Retry operation ${id}. No household was changed by this fixture.`,
      ),
    ).toBeVisible();
    await page.reload();
    await expect(page.locator('[name="id"]')).toHaveValue(id);
    await title.fill("A shared plan");
    await page.getByRole("button", { name: label, exact: true }).click();
    await expect(
      page.getByText(
        `Retry operation ${id}. No household was changed by this fixture.`,
      ),
    ).toBeVisible();
    const confirmation = page.waitForEvent("dialog");
    const navigation = page
      .getByRole("link", { name: `Start another ${kind}` })
      .click();
    const dialog = await confirmation;
    expect(dialog.message()).toBe("Discard your unsaved changes?");
    await dialog.accept();
    await navigation;
    await expect(page.locator('[name="id"]')).not.toHaveValue(id);
    await expect(title).toHaveValue("");
  });
}
