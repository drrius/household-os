import { expect, type Page } from "@playwright/test";

export async function exerciseMoneyHistory(
  alex: Page,
  sam: Page,
  tripUrl: string,
) {
  const originalUrl = sam.url();
  await alex.goto(originalUrl);
  await alex
    .getByRole("link", { name: "Correct or reverse", exact: true })
    .click();
  await alex
    .getByLabel("Description", { exact: true })
    .fill("CI corrected flight");
  await alex.getByLabel("Amount in CHF", { exact: true }).fill("100.00");
  await alex
    .getByRole("button", { name: "Save correction", exact: true })
    .click();
  await expect(
    alex.getByRole("heading", { name: "CI corrected flight", exact: true }),
  ).toBeVisible();
  const replacementUrl = alex.url();
  await expect(
    alex.getByRole("link", {
      name: "Original event: CI paid flight",
      exact: true,
    }),
  ).toBeVisible();
  await sam.goto("/money");
  await expect(
    sam.getByRole("region", { name: "You owe Alex", exact: true }),
  ).toContainText("50.00");
  await sam.goto(tripUrl);
  await expect(
    sam.getByRole("region", { name: "Paid expenses", exact: true }),
  ).toContainText("CHF 100.00");
  await alex.getByRole("link", { name: "Record refund", exact: true }).click();
  await alex.getByLabel("Refund amount in CHF", { exact: true }).fill("20.00");
  await alex
    .getByRole("button", { name: "Record refund", exact: true })
    .click();
  await expect(
    alex.getByRole("heading", {
      name: "Refund: CI corrected flight",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    alex.getByRole("link", {
      name: "Original event: CI corrected flight",
      exact: true,
    }),
  ).toBeVisible();
  await sam.goto("/money");
  await expect(
    sam.getByRole("region", { name: "You owe Alex", exact: true }),
  ).toContainText("40.00");
  await sam.goto(tripUrl);
  await expect(
    sam.getByRole("region", { name: "Paid expenses", exact: true }),
  ).toContainText("CHF 80.00");
  await sam.goto(originalUrl);
  await expect(
    sam.getByRole("heading", { name: "CI paid flight", exact: true }),
  ).toBeVisible();
  await expect(sam.getByText("Reversed", { exact: true })).toBeVisible();
  await sam.goto(replacementUrl);
  await expect(
    sam.getByRole("heading", { name: "CI corrected flight", exact: true }),
  ).toBeVisible();
  await expect(
    sam.getByRole("region", { name: "Related history", exact: true }),
  ).toContainText("Refund: CI corrected flight");
}
