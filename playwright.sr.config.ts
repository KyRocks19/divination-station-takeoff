import { defineConfig, devices } from "@playwright/test";
import { screenReaderConfig } from "@guidepup/playwright";

// Screen-reader tests (NVDA, through Guidepup). Not part of `npm test`: they need a real Windows desktop, speak out
// loud, and sign in to a dev server that is already running. See tests/a11y-sr/README.md.
export default defineConfig({
  ...screenReaderConfig,
  testDir: "./tests/a11y-sr",
  timeout: 5 * 60 * 1000,
  workers: 1,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: process.env.A11Y_BASE_URL ?? "http://localhost:3000",
    // Real Chrome, so the screen reader sees a normal browser window.
    ...devices["Desktop Chrome"],
    channel: "chrome",
    headless: false,
  },
});
