import { expect, test } from "@playwright/test";

test("serves the intentionally neutral application foundation", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { name: "Household OS" }),
  ).toBeVisible();
  await expect(
    page.getByText("Visual design is intentionally pending."),
  ).toBeVisible();
});
