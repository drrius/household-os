import { expect, test } from "@playwright/test";

test("anonymous visitors are sent to the neutral sign-in surface", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" }),
  ).toBeVisible();
});

test("the invalid-link surface exposes a semantic return link", async ({
  page,
}) => {
  await page.goto("/auth/error");

  await expect(
    page.getByRole("heading", { name: "Sign-in link invalid" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toHaveAttribute("href", "/sign-in");
});
