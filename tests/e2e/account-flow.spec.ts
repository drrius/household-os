import { expect, test } from "@playwright/test";

test("signed-out protected links retain their date context and inherited fragment", async ({
  page,
}) => {
  await page.goto("/plan?week=2026-09-07&day=2026-09-09#dinner");
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" }),
  ).toBeVisible();
  const location = new URL(page.url());
  expect(location.pathname).toBe("/sign-in");
  expect(location.searchParams.get("returnTo")).toBe(
    "/plan?week=2026-09-07&day=2026-09-09",
  );
  expect(location.hash).toBe("#dinner");
});

test("rejected passkey retry navigates to the validated destination with its fragment", async ({
  page,
}) => {
  const destination = "/plan?week=2026-09-07&day=2026-09-09";
  await page.goto(
    `/m7-fixture/account/sign-in?returnTo=${encodeURIComponent(destination)}#dinner`,
  );
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  // Fixture authentication does not create a real session. The attempted protected
  // destination is gated again; the redirect proves the exact destination survived.
  await expect(page).toHaveURL(/\/sign-in\?returnTo=/);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe(destination);
  expect(new URL(page.url()).hash).toBe("#dinner");
});

test("cancelled passkey attempts stay on sign-in with their destination intact", async ({
  page,
}) => {
  await page.goto("/m7-fixture/account/cancel?returnTo=%2Fhome%2Finbox");
  await page.getByRole("button", { name: "Sign in with passkey" }).click();
  await expect(page.getByRole("status")).toContainText(
    "Waiting for your passkey",
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Sign in with passkey" }),
  ).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.get("returnTo")).toBe("/home/inbox");
});

test("sign-out retries keep the device endpoint after browser push is removed", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let subscribed = true;
    Object.defineProperty(navigator.serviceWorker, "getRegistration", {
      value: async () => ({
        pushManager: {
          getSubscription: async () =>
            subscribed
              ? {
                  endpoint: "https://push.example.invalid/this-device",
                  unsubscribe: async () => {
                    subscribed = false;
                    sessionStorage.setItem(
                      "account-fixture-push-removed",
                      "yes",
                    );
                    return true;
                  },
                }
              : null,
        },
      }),
    });
  });
  await page.goto("/m7-fixture/account/sign-out");
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "Try again",
  );
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("account-fixture-push-removed"),
    ),
  ).toBe("yes");
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("account-fixture-endpoint"),
    ),
  ).toBe("https://push.example.invalid/this-device");
  await page.goto("/security");
  await expect(page).toHaveURL(/\/sign-in\?returnTo=%2Fsecurity$/);
});

test("sign-out remains available when a service worker has no push support", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, "getRegistration", {
      value: async () => ({}),
    });
  });
  await page.goto("/m7-fixture/account/sign-out");
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "This fixture rejected",
  );
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("account-fixture-endpoint"),
    ),
  ).toBe("none");
});
