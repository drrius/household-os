import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { expect, type Page, type TestInfo } from "@playwright/test";

export async function captureMemberView(
  page: Page,
  testInfo: TestInfo,
  name: string,
) {
  const url = new URL(page.url());
  if (
    process.env.GITHUB_ACTIONS !== "true" ||
    url.origin !== "http://127.0.0.1:4173" ||
    !/^\/(?:$|(?:plan|money|groceries|home|search)(?:\/|$))/.test(url.pathname)
  )
    throw new Error("Visual evidence requires a disposable CI member page.");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth <=
        document.documentElement.clientWidth + 1,
    ),
    `${name} must not overflow horizontally`,
  ).toBe(true);
  const file = testInfo.outputPath(`member-evidence-${name}`);
  await mkdir(dirname(file), { recursive: true });
  await writeFile(
    `${file}.aria.txt`,
    `Title: ${await page.title()}\nPath: ${url.pathname}\n${await page.locator("body").ariaSnapshot()}`,
  );
  await page.screenshot({ path: `${file}.png`, fullPage: true });
}
