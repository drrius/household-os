import { expect, type Page } from "@playwright/test";

export async function exerciseSearchReturn(sam: Page) {
  await sam.goto("/search");
  await sam
    .getByLabel("What are you looking for?", { exact: true })
    .fill("flight");
  await sam.getByLabel("Search in", { exact: true }).selectOption("trip");
  await sam
    .getByLabel("Include archived and finished", { exact: true })
    .check();
  await sam.getByRole("button", { name: "Search", exact: true }).click();
  await sam.getByRole("link", { name: /CI outbound flight/ }).click();
  await sam.getByRole("link", { name: "Edit booking", exact: true }).click();
  await expect(sam).toHaveURL(/\/edit\?.*fromSearch=/);
  await sam.reload();
  await sam
    .getByRole("textbox", { name: "Booking name", exact: true })
    .fill("CI updated flight");
  await sam.getByRole("button", { name: "Save booking", exact: true }).click();
  await expect(
    sam.getByRole("heading", {
      name: "CI updated flight",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  await sam
    .getByRole("link", { name: "Back to search results", exact: true })
    .click();
  await expect(
    sam.getByLabel("What are you looking for?", { exact: true }),
  ).toHaveValue("flight");
  await expect(sam.getByLabel("Search in", { exact: true })).toHaveValue(
    "trip",
  );
  await expect(
    sam.getByLabel("Include archived and finished", { exact: true }),
  ).toBeChecked();
  await expect(
    sam.getByRole("link", { name: /CI updated flight/ }),
  ).toBeVisible();
}
