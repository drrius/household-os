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

test("sign-out preserves browser push until server cleanup and authentication succeed", async ({
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
  ).toBeNull();
  await page.getByRole("button", { name: "Sign out of this device" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("account-fixture-endpoint"),
    ),
  ).toBe("https://push.example.invalid/this-device");
  expect(
    await page.evaluate(() =>
      sessionStorage.getItem("account-fixture-push-removed"),
    ),
  ).toBe("yes");
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

for (const failure of ["reject", "false", "pending", "throw"]) {
  test(`browser push cleanup ${failure} cannot block completed sign-out`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(navigator.serviceWorker, "getRegistration", {
        value: async () => ({
          pushManager: {
            getSubscription: async () => ({
              endpoint: "https://push.example.invalid/this-device",
              unsubscribe: () => {
                sessionStorage.setItem(
                  "account-fixture-cleanup-attempted",
                  "yes",
                );
                if (mode === "throw") throw new Error("Push unavailable");
                if (mode === "reject")
                  return Promise.reject(new Error("Push unavailable"));
                if (mode === "pending") return new Promise(() => {});
                return Promise.resolve(false);
              },
            }),
          },
        }),
      });
    }, failure);
    await page.goto("/m7-fixture/account/sign-out");
    await page.getByRole("button", { name: "Sign out of this device" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("account-fixture-cleanup-attempted"),
      ),
    ).toBeNull();
    await page.getByRole("button", { name: "Sign out of this device" }).click();
    await expect(page).toHaveURL(/\/sign-in$/);
    expect(
      await page.evaluate(() =>
        sessionStorage.getItem("account-fixture-cleanup-attempted"),
      ),
    ).toBe("yes");
  });
}

for (const stage of ["registration", "subscription"]) {
  for (const failure of ["reject", "pending"]) {
    test(`${stage} discovery ${failure} cannot block server sign-out`, async ({
      page,
    }) => {
      const browserErrors: string[] = [];
      page.on("pageerror", (error) => browserErrors.push(error.message));
      await page.addInitScript(
        ({ stage, failure }) => {
          const unavailable = () =>
            failure === "reject"
              ? Promise.reject(new Error("Browser discovery unavailable"))
              : new Promise(() => {});
          Object.defineProperty(navigator.serviceWorker, "getRegistration", {
            value: () =>
              stage === "registration"
                ? unavailable()
                : Promise.resolve({
                    pushManager: { getSubscription: unavailable },
                  }),
          });
        },
        { stage, failure },
      );
      await page.goto("/m7-fixture/account/sign-out-fallback");
      await page
        .getByRole("button", { name: "Sign out of this device" })
        .click();
      // The deliberately rejected server fixture proves discovery reached the
      // server action; a browser error must never replace this recoverable error.
      await expect(page.getByRole("main").getByRole("alert")).toContainText(
        "This fixture rejected",
      );
      expect(
        await page.evaluate(() =>
          sessionStorage.getItem("account-fixture-endpoint"),
        ),
      ).toBe("none");
      await page
        .getByRole("button", { name: "Sign out of this device" })
        .click();
      await expect(page).toHaveURL(/\/sign-in\?push=paused$/);
      await expect(page.getByRole("status")).toContainText(
        "Push notifications were paused on your devices",
      );
      await expect(page.getByRole("status")).toContainText(
        "Your partner’s notifications are unchanged",
      );
      expect(browserErrors).toEqual([]);
    });
  }
}
