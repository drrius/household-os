import { expect, type Page } from "@playwright/test";

export async function exerciseShoppingMoney(alex: Page, sam: Page) {
  await alex.goto("/groceries");
  await sam.goto("/groceries");
  const quickAdd = alex.getByRole("textbox", {
    name: "Add grocery item",
    exact: true,
  });
  await quickAdd.fill("CI breakfast oats");
  await quickAdd.press("Enter");
  await expect(
    alex.getByRole("link", { name: "CI breakfast oats", exact: true }),
  ).toBeVisible();
  await expect(
    sam.getByRole("link", { name: "CI breakfast oats", exact: true }),
  ).toBeVisible();
  await alex
    .getByRole("checkbox", {
      name: "Add CI breakfast oats to your cart",
      exact: true,
    })
    .click();
  await expect(
    sam.getByRole("checkbox", {
      name: "CI breakfast oats is in Alex's cart",
      exact: true,
    }),
  ).toBeDisabled();
  await alex
    .getByRole("link", { name: "Finish shopping", exact: true })
    .click();
  await alex
    .getByRole("textbox", { name: /^Receipt total in CHF/ })
    .fill("30.00");
  await alex
    .getByRole("checkbox", {
      name: "Create a shared expense draft",
      exact: true,
    })
    .check();
  await alex
    .getByLabel("Description", { exact: true })
    .fill("CI weekly groceries");
  await alex.getByLabel("Amount in CHF", { exact: true }).fill("20.00");
  await alex
    .getByRole("button", { name: "Finish shopping", exact: true })
    .click();
  await expect(
    alex.getByRole("heading", {
      name: "Shopping complete",
      exact: true,
      level: 1,
    }),
  ).toBeVisible();
  const shoppingUrl = alex.url();
  await expect(
    alex.getByRole("region", { name: "Purchased items", exact: true }),
  ).toContainText("CI breakfast oats");
  await expect(
    alex.getByRole("region", { name: "Shared expense", exact: true }),
  ).toContainText("Shared amount CHF 20.00");
  await sam.goto("/money");
  await expect(
    sam.getByRole("region", { name: "You owe Alex", exact: true }),
  ).toContainText("40.00");
  await alex
    .getByRole("link", { name: "Review shared expense", exact: true })
    .click();
  await expect(alex.getByLabel("Amount in CHF", { exact: true })).toHaveValue(
    "20.00",
  );
  await alex
    .getByRole("button", { name: "Post expense draft", exact: true })
    .click();
  await expect(alex).toHaveURL(/\/money$/);
  await sam.goto("/money");
  await expect(
    sam.getByRole("region", { name: "You owe Alex", exact: true }),
  ).toContainText("50.00");
  for (const member of [alex, sam]) {
    await member.goto(shoppingUrl);
    await member
      .getByRole("link", { name: "View posted expense", exact: true })
      .click();
    await expect(member).toHaveURL(/\/money\/events\/[0-9a-f-]+$/);
    await expect(
      member.getByRole("heading", {
        name: "CI weekly groceries",
        exact: true,
        level: 1,
      }),
    ).toBeVisible();
  }
}
