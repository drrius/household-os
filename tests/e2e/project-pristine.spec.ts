import { expect, test } from "@playwright/test";

for (const kind of ["project", "task"]) {
  const titleLabel = kind === "project" ? "Trip name" : "What needs doing?";
  const saveLabel = kind === "project" ? "Save changes" : "Save task";

  test(`${kind} pristine fields accept refreshed values and their version`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/projects?view=concurrent-${kind}`);
    await page
      .getByRole("button", { name: "Simulate partner refresh" })
      .click();
    await expect(
      page.getByRole("textbox", { name: titleLabel, exact: true }),
    ).toHaveValue("Partner's new title");
    await page.getByRole("button", { name: saveLabel, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Current snapshot accepted",
    );
  });

  test(`${kind} reversion after a stale save adopts the waiting update`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/projects?view=concurrent-${kind}`);
    const title = page.getByRole("textbox", { name: titleLabel, exact: true });
    const original = await title.inputValue();
    await title.fill("My changes");
    await page
      .getByRole("button", { name: "Simulate partner refresh" })
      .click();
    await page.getByRole("button", { name: saveLabel, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "This changed since you opened it",
    );
    await title.fill(original);
    await expect(title).toHaveValue("Partner's new title");
    await page.getByRole("button", { name: saveLabel, exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Current snapshot accepted",
    );
  });

  test(`${kind} selection-only edits retain the baseline until reverted`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/projects?view=concurrent-${kind}`);
    if (kind === "project")
      await page.getByText("Budget and status", { exact: true }).click();
    const select = page.locator(
      kind === "project" ? '[name="status"]' : '[name="assigned_member_id"]',
    );
    const initial = await select.inputValue();
    await select.selectOption(
      kind === "project" ? "complete" : "00000000-0000-4000-8000-000000000021",
    );
    await page
      .getByRole("button", { name: "Simulate partner refresh" })
      .click();
    const title = page.getByRole("textbox", { name: titleLabel, exact: true });
    await expect(title).not.toHaveValue("Partner's new title");
    await select.selectOption(initial);
    await expect(title).toHaveValue("Partner's new title");
  });
}
