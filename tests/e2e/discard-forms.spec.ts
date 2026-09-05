import { expect, test } from "@playwright/test";

async function openFixture(page: import("@playwright/test").Page, query = "") {
  await page.addInitScript(() =>
    localStorage.setItem("household-os:welcome-dismissed", "1"),
  );
  await page.goto(`/m7-fixture/discard${query}`);
}

test("pristine, reverted, and tiny forms leave without confirmation", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await openFixture(page);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  await openFixture(page);
  await page.getByLabel("Note", { exact: true }).fill("Edited");
  await page.getByLabel("Note", { exact: true }).fill("Original note");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  await openFixture(page, "?kind=tiny");
  await page.getByLabel("Note", { exact: true }).fill("Tiny action");
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  expect(dialogs).toEqual([]);
});

test("edited Cancel and in-app links can stay or explicitly discard", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByLabel("Note", { exact: true }).fill("Keep this edit");
  const confirmations: string[] = [];
  page.on("dialog", async (dialog) => {
    confirmations.push(dialog.message());
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue(
    "Keep this edit",
  );
  await page.getByRole("link", { name: "Another page" }).click();
  expect(confirmations).toEqual([
    "Discard your unsaved changes?",
    "Discard your unsaved changes?",
  ]);
  page.removeAllListeners("dialog");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("link", { name: "Another page" }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
});

test("custom hidden select edits and reverts are compared to the original baseline", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Garden", exact: true }).click();
  let count = 0;
  page.on("dialog", async (dialog) => {
    count += 1;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  expect(count).toBe(1);
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  expect(count).toBe(1);
});

test("failed saves preserve dirty values and the initial baseline across recovery remount", async ({
  page,
}) => {
  await openFixture(page);
  await page.getByLabel("Note", { exact: true }).fill("reject");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Garden", exact: true }).click();
  await page.getByRole("button", { name: "Save fixture", exact: true }).click();
  await expect(
    page.getByText("Fixture save failed. Your values are preserved."),
  ).toBeVisible();
  await expect(page.getByLabel("Note", { exact: true })).toHaveValue("reject");
  await expect(page.getByRole("combobox")).toContainText("Garden");
  let count = 0;
  page.on("dialog", async (dialog) => {
    count += 1;
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  expect(count).toBe(1);
  await page.getByLabel("Note", { exact: true }).fill("Original note");
  await page.getByRole("combobox").click();
  await page.getByRole("option", { name: "Home", exact: true }).click();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  expect(count).toBe(1);
});

test("successful returned saves and redirects do not prompt", async ({
  page,
}) => {
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await openFixture(page);
  await page.getByLabel("Note", { exact: true }).fill("Saved change");
  await page.getByRole("button", { name: "Save fixture", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Save fixture", exact: true }),
  ).toBeEnabled();
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  await openFixture(page, "?outcome=redirect");
  await page.getByLabel("Note", { exact: true }).fill("Redirect after save");
  await page.getByRole("button", { name: "Save fixture", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Saved fixture" }),
  ).toBeVisible();
  expect(dialogs).toEqual([]);
});

test("dirty values survive refreshed server defaults and same-page anchors remain usable", async ({
  page,
}) => {
  await openFixture(page);
  const seed = await page.getByTestId("refresh-seed").textContent();
  await page
    .getByLabel("Refresh default", { exact: true })
    .fill("Keep local edits");
  await page.getByRole("button", { name: "Refresh server defaults" }).click();
  await expect(page.getByTestId("refresh-seed")).not.toHaveText(seed!);
  await expect(page.getByLabel("Refresh default", { exact: true })).toHaveValue(
    "Keep local edits",
  );
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.dismiss();
  });
  await page.getByRole("link", { name: "Jump to details" }).click();
  await expect(page).toHaveURL(/#details$/);
  expect(dialogs).toEqual([]);
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  expect(dialogs).toEqual(["Discard your unsaved changes?"]);
});

test("unload cancellation reflects actual dirty values", async ({ page }) => {
  await openFixture(page);
  const cancelled = () =>
    page.evaluate(
      () =>
        !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
    );
  expect(await cancelled()).toBe(false);
  await page.getByLabel("Note", { exact: true }).fill("Unsaved");
  expect(await cancelled()).toBe(true);
  await page.getByLabel("Note", { exact: true }).fill("Original note");
  expect(await cancelled()).toBe(false);
});

for (const [kind, label] of [
  ["expense", "Description"],
  ["routine", "Title"],
] as const) {
  test(`${kind} forms opt into substantial discard protection`, async ({
    page,
  }) => {
    const hydrationErrors: string[] = [];
    page.on("console", (message) => {
      if (/hydrat/i.test(message.text())) hydrationErrors.push(message.text());
    });
    await openFixture(page, `?kind=${kind}`);
    await page
      .getByLabel(label, { exact: true })
      .fill("Unsaved household work");
    let count = 0;
    page.on("dialog", async (dialog) => {
      count += 1;
      await dialog.dismiss();
    });
    await page.getByRole("link", { name: "Cancel", exact: true }).click();
    expect(count).toBe(1);
    await expect(page.getByLabel(label, { exact: true })).toHaveValue(
      "Unsaved household work",
    );
    expect(hydrationErrors).toEqual([]);
  });
}

test("pristine refreshed text defaults leave without a false discard prompt", async ({
  page,
}) => {
  await openFixture(page);
  const seed = await page.getByTestId("refresh-seed").textContent();
  await page.getByRole("button", { name: "Refresh server defaults" }).click();
  await expect(page.getByTestId("refresh-seed")).not.toHaveText(seed!);
  const dialogs: string[] = [];
  page.on("dialog", async (dialog) => {
    dialogs.push(dialog.message());
    await dialog.accept();
  });
  await page.getByRole("link", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Discard destination" }),
  ).toBeVisible();
  expect(dialogs).toEqual([]);
});

test("pending disabled controls do not manufacture unsaved edits", async ({
  page,
}) => {
  await openFixture(page);
  let releaseRequest!: () => void;
  const pendingRequest = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route("**/m7-fixture/discard", async (route) => {
    if (route.request().method() === "POST") await pendingRequest;
    await route.continue();
  });
  await page.getByRole("button", { name: "Save fixture", exact: true }).click();
  await expect(page.getByLabel("Stable value", { exact: true })).toBeDisabled();
  expect(
    await page.evaluate(
      () =>
        !window.dispatchEvent(new Event("beforeunload", { cancelable: true })),
    ),
  ).toBe(false);
  releaseRequest();
  await expect(
    page.getByRole("button", { name: "Save fixture", exact: true }),
  ).toBeEnabled();
});
