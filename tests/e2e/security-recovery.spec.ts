import { expect, test } from "@playwright/test";

test.describe("Security with unavailable passkeys", () => {
  // Native WPE getSubscription stalls the page in this runner. These cases
  // exercise real sign-out actions; discovery failure/timeout cases above
  // independently control the browser push APIs.
  test.use({ serviceWorkers: "block" });
  for (const state of ["error", "pending"]) {
    test(`sign-out remains available when passkey listing is ${state}`, async ({
      page,
    }) => {
      await page.goto(`/m7-fixture/account/security-${state}`, {
        waitUntil: "commit",
      });
      await expect(
        page.getByRole("heading", { name: "Security", exact: true }),
      ).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Sign out of this device" }),
      ).toBeEnabled();
      if (state === "error")
        await expect(page.getByRole("main").getByRole("alert")).toContainText(
          "You can still sign out",
        );
      else
        await expect(page.getByRole("status")).toContainText(
          "Loading passkeys",
        );
      await page
        .getByRole("button", { name: "Sign out of this device" })
        .click();
      // The fixture has no member session; reaching the real action's auth gate
      // proves sign-out stays interactive even while passkey loading is pending.
      await expect(page).toHaveURL(/\/sign-in(?:\?|$)/);
    });
  }

  test("failed passkey loading can recover without leaving Security", async ({
    page,
  }) => {
    await page.goto("/m7-fixture/account/security-error");
    await expect(page.getByRole("main").getByRole("alert")).toContainText(
      "Your passkeys could not load",
    );
    await page.getByRole("button", { name: "Retry loading passkeys" }).click();
    await expect(
      page.getByText("Recovery authenticator", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Sign out of this device" }),
    ).toBeEnabled();
  });
});
