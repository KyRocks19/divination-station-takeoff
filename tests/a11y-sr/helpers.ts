import { expect, type Page } from "@playwright/test";

// A dev server on A11Y_BASE_URL (default http://localhost:3000, the dev database) and a test account in A11Y_USER and
// A11Y_PASS. Never put the password in a file in the repo.
export const user = process.env.A11Y_USER;
export const pass = process.env.A11Y_PASS;

export async function signIn(page: Page) {
  const login = await page.request.post("/api/auth/login", { data: { username: user, password: pass } });
  expect(login.status()).toBe(200);
  await page.request.post("/api/privacy/ack");
  await page.request.post("/api/tour/seen");
}

/** Everything the screen reader has said so far, as one lower-case string. */
export async function said(nvda: { spokenPhraseLog(): Promise<string[]> }) {
  return (await nvda.spokenPhraseLog()).join(" | ").toLowerCase();
}

/**
 * Guidepup's navigateToWebContent() gives the page focus by clicking the middle of <body>, which presses whatever link or
 * choice happens to be there (a reading in a list opened itself; a font in Settings got chosen). A see-through cover over
 * the window takes that click instead, and is removed straight after. Use this instead of nvda.navigateToWebContent().
 */
export async function toWebContent(page: Page, nvda: { navigateToWebContent(): Promise<void> }) {
  await page.evaluate(() => {
    const cover = document.createElement("div");
    cover.id = "sr-test-click-cover";
    cover.setAttribute("aria-hidden", "true");
    cover.style.cssText = "position:fixed;inset:0;z-index:2147483647;background:transparent";
    document.body.appendChild(cover);
  });
  try {
    await nvda.navigateToWebContent();
  } finally {
    await page.evaluate(() => document.getElementById("sr-test-click-cover")?.remove());
  }
}
