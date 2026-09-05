import { expect, type Page } from "@playwright/test";

export async function exerciseProjectHandoff(
  alex: Page,
  sam: Page,
  tripUrl: string,
) {
  await alex.goto(tripUrl);
  await alex.getByRole("link", { name: "Add task", exact: true }).click();
  await alex
    .getByLabel("What needs doing?", { exact: true })
    .fill("CI pack passports");
  await alex.getByLabel(/^Who will do it\?/).selectOption({ label: "Sam" });
  await alex.getByRole("button", { name: "Add task", exact: true }).click();
  await expect(
    alex.getByRole("heading", { name: "CI holiday", exact: true }),
  ).toBeVisible();
  const checklist = alex.getByRole("region", {
    name: "Checklists",
    exact: true,
  });
  await expect(checklist).toContainText("1 to do · 0 done");
  await sam.goto("/home/inbox");
  await sam.getByRole("link", { name: /Task assigned to you/ }).click();
  await expect(sam).toHaveURL(/\/plan\/projects\/[^/]+\/tasks\/[^/?]+/);
  await expect(
    sam.getByLabel("What needs doing?", { exact: true }),
  ).toHaveValue("CI pack passports");
  await sam.getByRole("link", { name: "Cancel", exact: true }).click();
  const row = sam.getByRole("listitem").filter({
    has: sam.getByRole("link", { name: "CI pack passports", exact: true }),
  });
  await row.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    sam.getByRole("region", { name: "Checklists", exact: true }),
  ).toContainText("0 to do · 1 done");
  // No reload: this checks the other member's subscribed project view.
  // Keep CI failing on stale partner state while exercising independent journeys.
  await expect.soft(checklist).toContainText("0 to do · 1 done", {
    timeout: 30_000,
  });
}
