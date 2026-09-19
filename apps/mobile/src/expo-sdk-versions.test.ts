import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const mobileRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf8")) as Record<string, unknown>;
}

describe("Expo SDK runtime pins", () => {
  it("keeps react and react-native on Expo Metro's bundled versions", () => {
    const app = readJson(join(mobileRoot, "package.json"));
    const bundled = readJson(
      join(mobileRoot, "node_modules/expo/bundledNativeModules.json"),
    );
    const dependencies = app.dependencies as Record<string, string>;

    expect(dependencies.react).toBe(bundled.react);
    expect(dependencies["react-native"]).toBe(bundled["react-native"]);
  });
});
