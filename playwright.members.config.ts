import { defineConfig, devices } from "@playwright/test";
import { localCiStatus } from "./tests/member-e2e/local-runtime";

const status = localCiStatus();
const publicKey = status.PUBLISHABLE_KEY ?? status.ANON_KEY;
if (!publicKey) throw new Error("Local CI publishable key is unavailable.");

export default defineConfig({
  testDir: "./tests/member-e2e",
  testMatch: "**/*.spec.ts",
  workers: 1,
  retries: 0,
  timeout: 180_000,
  expect: { timeout: 15_000 },
  reporter: "list",
  use: { baseURL: "http://127.0.0.1:4173", trace: "off" },
  projects: [
    { name: "member-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "pnpm dev --webpack --hostname 127.0.0.1 --port 4173",
    url: "http://127.0.0.1:4173/sign-in",
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      HOUSEHOLD_OS_E2E_FIXTURES: "0",
      HOUSEHOLD_OS_VERIFY_DIST_DIR: ".next-verify",
      NEXT_PUBLIC_SUPABASE_URL: status.API_URL!,
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: publicKey,
    },
  },
});
