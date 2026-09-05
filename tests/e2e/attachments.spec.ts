import { expect, test } from "@playwright/test";

const path =
  "00000000-0000-4000-8000-000000000001/receipts/00000000-0000-4000-8000-000000000002.pdf";
const file = {
  name: "receipt.pdf",
  mimeType: "application/pdf",
  buffer: Buffer.from("%PDF-1.7\nfixture"),
};

test("receipt upload retains its path and excludes the binary from the parent form", async ({
  page,
}) => {
  await page.route("**/api/attachments**", (route) =>
    route.fulfill({
      status: route.request().method() === "DELETE" ? 204 : 201,
      contentType: "application/json",
      body:
        route.request().method() === "DELETE" ? "" : JSON.stringify({ path }),
    }),
  );
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue(path);
  await expect(page.getByLabel("Receipt (optional)")).toHaveValue("");
  await page.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue("");
});

test("upload failures explain recovery and block accidental save", async ({
  page,
}) => {
  await page.route("**/api/attachments", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "Couldn't upload the file. Please try again.",
      }),
    }),
  );
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("Couldn't upload");
  expect(
    await page
      .getByLabel("Receipt (optional)")
      .evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(false);
  await page.getByRole("button", { name: "Remove attachment" }).click();
  expect(
    await page
      .getByLabel("Receipt (optional)")
      .evaluate((input: HTMLInputElement) => input.checkValidity()),
  ).toBe(true);
});

test("a lost upload response can retry the same upload without creating a second file", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route("**/api/attachments", async (route) => {
    const body = route.request().postData() ?? "";
    const id = body.match(/name="uploadId"\r\n\r\n([^\r]+)/)?.[1] ?? "";
    ids.push(id);
    if (ids.length === 1) await route.abort("failed");
    else
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ path }),
      });
  });
  await page.goto("/m7-fixture/attachment");
  await page
    .getByLabel("Receipt (optional)")
    .setInputFiles({ ...file, mimeType: "" });
  await expect(
    page.getByRole("button", { name: "Retry upload" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry upload" }).click();
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe("");
  expect(ids[1]).toBe(ids[0]);
});

test("replacing a ready attachment discards the previous temporary upload", async ({
  page,
}) => {
  const replacement = path.replace("000000000002.pdf", "000000000003.pdf");
  let uploads = 0;
  const discarded: string[] = [];
  await page.route("**/api/attachments**", async (route) => {
    if (route.request().method() === "DELETE") {
      discarded.push(
        new URL(route.request().url()).searchParams.get("path") ?? "",
      );
      await route.fulfill({ status: 204 });
    } else {
      uploads += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ path: uploads === 1 ? path : replacement }),
      });
    }
  });
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(discarded).toEqual([path]);
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue(
    replacement,
  );
});

test("an expired upload offers a fresh file selection instead of an impossible retry", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route("**/api/attachments", async (route) => {
    ids.push(
      (route.request().postData() ?? "").match(
        /name="uploadId"\r\n\r\n([^\r]+)/,
      )?.[1] ?? "",
    );
    await route.fulfill({
      status: ids.length === 1 ? 409 : 201,
      contentType: "application/json",
      body: JSON.stringify(
        ids.length === 1
          ? { error: "This upload expired. Choose the file again." }
          : { path },
      ),
    });
  });
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toContainText("Choose the file again");
  await expect(page.getByRole("button", { name: "Retry upload" })).toHaveCount(
    0,
  );
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(ids).toHaveLength(2);
  expect(ids[1]).not.toBe(ids[0]);
});

for (const invalid of [
  {
    name: "unsupported.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("not a photo or PDF"),
    message: "Choose a photo or PDF",
  },
  {
    name: "broken.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from([255, 216, 255, 0, 0, 0, 0, 0, 0, 0, 255, 217]),
    message: "Choose another image",
  },
  {
    name: "large.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.concat([
      Buffer.from("%PDF-1.7\n"),
      Buffer.alloc(4 * 1024 * 1024),
    ]),
    message: "smaller than 4 MB",
  },
]) {
  test(`local preparation failure for ${invalid.name} requires a new selection`, async ({
    page,
  }) => {
    let uploads = 0;
    await page.route("**/api/attachments", async (route) => {
      uploads += 1;
      await route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ path }),
      });
    });
    await page.goto("/m7-fixture/attachment");
    const input = page.getByLabel("Receipt (optional)");
    await input.setInputFiles(invalid);
    await expect(page.getByRole("status")).toContainText(invalid.message);
    await expect(
      page.getByRole("button", { name: "Retry upload" }),
    ).toHaveCount(0);
    await expect(input).toHaveValue("");
    expect(
      await input.evaluate((element: HTMLInputElement) =>
        element.checkValidity(),
      ),
    ).toBe(false);
    expect(uploads).toBe(0);
    await input.setInputFiles(file);
    await expect(page.getByRole("status")).toHaveText("Attachment ready.");
    expect(uploads).toBe(1);
  });
}

test("a temporary reservation outage retries with the same upload identity", async ({
  page,
}) => {
  const ids: string[] = [];
  await page.route("**/api/attachments", async (route) => {
    ids.push(
      (route.request().postData() ?? "").match(
        /name="uploadId"\r\n\r\n([^\r]+)/,
      )?.[1] ?? "",
    );
    await route.fulfill({
      status: ids.length === 1 ? 503 : 201,
      contentType: "application/json",
      body: JSON.stringify(
        ids.length === 1
          ? { error: "Couldn't reserve the upload. Please retry." }
          : { path },
      ),
    });
  });
  await page.goto("/m7-fixture/attachment");
  await page.getByLabel("Receipt (optional)").setInputFiles(file);
  await expect(
    page.getByRole("button", { name: "Retry upload" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Retry upload" }).click();
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(ids).toHaveLength(2);
  expect(ids[0]).not.toBe("");
  expect(ids[1]).toBe(ids[0]);
});

test("a PNG photo is prepared as JPEG before upload", async ({ page }) => {
  const bodies: string[] = [];
  await page.route("**/api/attachments", async (route) => {
    bodies.push(route.request().postData() ?? "");
    await route.fulfill({
      status: 201,
      contentType: "application/json",
      body: JSON.stringify({ path: path.replace(".pdf", ".jpg") }),
    });
  });
  await page.goto("/m7-fixture/attachment");
  const encoded = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 16;
    const context = canvas.getContext("2d")!;
    context.fillStyle = "#247e62";
    context.fillRect(0, 0, 16, 16);
    return canvas.toDataURL("image/png").split(",")[1]!;
  });
  await page.getByLabel("Receipt (optional)").setInputFiles({
    name: "photo.png",
    mimeType: "image/png",
    buffer: Buffer.from(encoded, "base64"),
  });
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  expect(bodies).toHaveLength(1);
  expect(bodies[0]).toContain('filename="photo.jpg"');
  expect(bodies[0]).toContain("Content-Type: image/jpeg");
});

test("failed attachment removal explains retry and releases validation after success", async ({
  page,
}) => {
  let removals = 0;
  await page.route("**/api/attachments**", async (route) => {
    if (route.request().method() === "DELETE") {
      removals += 1;
      await route.fulfill({ status: removals === 1 ? 503 : 204 });
    } else {
      await route.fulfill({ status: 201, json: { path } });
    }
  });
  await page.goto("/m7-fixture/attachment");
  const input = page.getByLabel("Receipt (optional)");
  await input.setInputFiles(file);
  await expect(page.getByRole("status")).toHaveText("Attachment ready.");
  await page.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.getByRole("status")).toContainText("Try removing it again");
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue(path);
  expect(
    await input.evaluate((field: HTMLInputElement) => field.validationMessage),
  ).toBe(
    "Retry, choose another file, or remove this attachment before saving.",
  );
  await page.getByRole("button", { name: "Remove attachment" }).click();
  await expect(page.locator('input[name="receiptPath"]')).toHaveValue("");
  expect(
    await input.evaluate((field: HTMLInputElement) => field.checkValidity()),
  ).toBe(true);
});
