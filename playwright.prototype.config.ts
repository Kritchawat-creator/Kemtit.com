import { defineConfig } from "@playwright/test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const port = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${port}`;

function readLocalEnvValue(key: string): string | undefined {
  try {
    const envFile = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = envFile.match(new RegExp(`^(?:export\\s+)?${escapedKey}\\s*=\\s*(.*)$`, "m"));
    const value = match?.[1]?.trim();
    if (!value) return undefined;
    return value.replace(/^(?:"([^"]*)"|'([^']*)').*$/, (_whole, doubleQuoted, singleQuoted) =>
      doubleQuoted ?? singleQuoted ?? "",
    );
  } catch {
    return undefined;
  }
}

function assertLoopbackUrl(name: string, value: string | undefined) {
  let parsed: URL;
  try {
    if (!value) throw new Error("missing URL");
    parsed = new URL(value);
  } catch {
    throw new Error(`${name} must be set to a loopback URL before running prototype auth E2E.`);
  }

  const loopbackHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (parsed.protocol !== "http:" || !loopbackHosts.has(parsed.hostname)) {
    throw new Error(`${name} must use HTTP on a loopback host before running prototype auth E2E.`);
  }
}

assertLoopbackUrl("PLAYWRIGHT_BASE_URL", baseURL);
assertLoopbackUrl("MAILPIT_URL", process.env.MAILPIT_URL ?? "http://127.0.0.1:54324");

const configuredSupabaseUrls = [
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL"),
  process.env.SUPABASE_URL ?? readLocalEnvValue("SUPABASE_URL"),
].filter((value): value is string => Boolean(value));
if (configuredSupabaseUrls.length === 0) {
  throw new Error("A loopback Supabase URL is required before running prototype auth E2E.");
}
configuredSupabaseUrls.forEach((url, index) => assertLoopbackUrl(`Supabase URL ${index + 1}`, url));

/** Isolated browser regression coverage for the local, data-only /prototype route. */
export default defineConfig({
  testDir: "./e2e",
  testMatch: "prototype.spec.ts",
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: "list",
  use: {
    baseURL,
    browserName: "chromium",
    channel: "chrome",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "prototype-390", use: { viewport: { width: 390, height: 844 } } },
    { name: "prototype-768", use: { viewport: { width: 768, height: 1024 } } },
    { name: "prototype-1440", use: { viewport: { width: 1440, height: 1000 } } },
  ],
  webServer: {
    command: `pnpm dev -p ${port}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
  },
});
