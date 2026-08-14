import { expect, test } from "@playwright/test";

const protectedDestinations = [
  "/",
  "/plan",
  "/groceries",
  "/money",
  "/home",
  "/security",
];

for (const destination of protectedDestinations) {
  test(`anonymous visitors cannot open ${destination}`, async ({ page }) => {
    await page.goto(destination);

    await expect(page).toHaveURL(/\/sign-in$/);
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign in with passkey" }),
    ).toBeVisible();
  });
}

test("auth failure and membership-denied gates remain usable", async ({
  page,
}) => {
  await page.goto("/auth/error");
  await expect(
    page.getByRole("heading", { name: "Sign-in link invalid" }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Back to sign in" }),
  ).toHaveAttribute("href", "/sign-in");

  await page.goto("/access-denied");
  await expect(
    page.getByRole("heading", { name: "No household membership" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Sign out and return to sign in" }),
  ).toBeVisible();
});

test("a magic-link preview waits for a human before consuming the token", async ({
  page,
}) => {
  await page.goto("/auth/consume?token_hash=preview-safe-token&type=magiclink");

  await expect(
    page.getByRole("heading", { name: "Set up your passkey" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue to passkey setup" }),
  ).toBeVisible();
  await expect(
    page.getByText("This one-time link has not been used yet."),
  ).toBeVisible();
});
