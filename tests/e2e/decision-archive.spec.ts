import { expect, test } from "@playwright/test";
test("archived decisions keep their options visible without offering a new choice", async ({
  page,
}) => {
  await page.goto("/m7-fixture/decision-archive");
  const active = page.getByRole("region", {
    name: "Active decision",
    exact: true,
  });
  const archived = page.getByRole("region", {
    name: "Archived decision",
    exact: true,
  });
  await expect(
    active.getByRole("button", { name: "Choose this option" }),
  ).toBeVisible();
  await expect(archived.getByRole("heading", { name: "Train" })).toBeVisible();
  await expect(
    archived.getByRole("button", { name: "Choose this option" }),
  ).toHaveCount(0);
  await expect(archived.getByText("Add option", { exact: true })).toHaveCount(
    0,
  );
});
