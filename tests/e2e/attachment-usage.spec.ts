import { expect, test } from "@playwright/test";
for (const [state, label, warning] of [
  ["zero", "0 bytes", false],
  ["below", "499.9 MB", false],
  ["threshold", "500 MB", true],
] as const) {
  test(`attachment usage ${state} is explicit without blocking upload`, async ({
    page,
  }) => {
    await page.goto(`/m7-fixture/attachment-usage?state=${state}`);
    await expect(
      page.getByText(`${label} used · Private photos & PDFs`, { exact: true }),
    ).toBeVisible();
    const notice = page.getByText("Attachment storage has reached 500 MB.", {
      exact: true,
    });
    if (warning) {
      await expect(notice).toBeVisible();
      await expect(
        page.getByText("You can keep uploading.", { exact: false }),
      ).toBeVisible();
    } else await expect(notice).toHaveCount(0);
    const widths = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      client: document.documentElement.clientWidth,
    }));
    expect(widths.scroll).toBeLessThanOrEqual(widths.client + 1);
  });
}
test("large totals retain exact bytes and warn", async ({ page }) => {
  await page.goto("/m7-fixture/attachment-usage?state=above");
  await expect(
    page.locator('[title="900719925474099312345 bytes"]'),
  ).toBeVisible();
  await expect(
    page.getByText("Attachment storage has reached 500 MB.", { exact: true }),
  ).toBeVisible();
});
test("unknown usage never looks empty and retry refreshes the server section", async ({
  page,
  context,
}) => {
  await page.goto("/m7-fixture/attachment-usage?state=error");
  await expect(
    page.getByText("Storage usage is unavailable.", { exact: false }),
  ).toBeVisible();
  await expect(page.getByText("0 bytes used", { exact: false })).toHaveCount(0);
  await context.addCookies([
    {
      name: "usage-fixture-recovered",
      value: "1",
      url: `http://127.0.0.1:${process.env.PLAYWRIGHT_PORT ?? "3000"}`,
    },
  ]);
  await page.getByRole("button", { name: "Retry usage" }).click();
  await expect(
    page.getByText("0 bytes used · Private photos & PDFs", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry usage" })).toHaveCount(
    0,
  );
});
test("loading is distinct from zero before the aggregate arrives", async ({
  page,
}) => {
  await page.goto("/m7-fixture/attachment-usage?state=loading", {
    waitUntil: "commit",
  });
  await expect(
    page.getByText("Checking attachment usage…", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText("0 bytes used · Private photos & PDFs", { exact: true }),
  ).toBeVisible();
});
