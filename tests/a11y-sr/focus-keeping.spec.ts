import { nvdaTest as test } from "@guidepup/playwright";
import { expect } from "@playwright/test";

import { pass, said, signIn, toWebContent, user } from "./helpers";

// What FocusKeeper (components/FocusKeeper.tsx) and the reading page's changes of 2026-10-23 should sound like. The cloud
// run (scripts/a11y-flows.mts) checked where focus goes; only NVDA can say what is heard there.

test.beforeEach(async ({ page }) => {
  test.skip(!user || !pass, "Set A11Y_USER and A11Y_PASS to a dev-database test account");
  await signIn(page);
});

test("a draw that opens its saved page: NVDA lands on the new page's heading, not the top of the page", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/runes/new", { waitUntil: "load" });
  await toWebContent(page, nvda);
  await page.getByRole("button", { name: "Draw some runes" }).focus();
  await nvda.press("Enter");
  await page.waitForURL(/\/runes\/\d+/);
  await expect(page.locator("main h1")).toBeFocused();
  await nvda.perform(nvda.keyboardCommands.reportCurrentFocus);
  const heard = await said(nvda);
  console.log("after the draw:", heard);
  expect(heard).toContain("heading");
});

test("a reading's spread: each card is a button NVDA can reach in browse mode", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  const first = page.locator("main a[href^='/readings/']").first();
  test.skip(!(await first.count()), "The test account has no readings");
  await first.click();
  await page.waitForURL(/\/readings\/\d+/);
  await toWebContent(page, nvda);
  // B moves to the next button in browse mode; a card's name ends with "show details".
  let heard = "";
  for (let i = 0; i < 40 && !heard.includes("show details"); i++) {
    await nvda.press("b");
    heard = (await nvda.lastSpokenPhrase()).toLowerCase();
  }
  console.log("a card:", heard);
  expect(heard).toContain("show details");
});

test("a journal note saved: focus returns to the note box, and NVDA reads its label", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  const first = page.locator("main a[href^='/readings/']").first();
  test.skip(!(await first.count()), "The test account has no readings");
  await first.click();
  await page.waitForURL(/\/readings\/\d+/);
  await toWebContent(page, nvda);
  const box = page.getByLabel("Add your note");
  await box.fill("A note from the screen-reader test");
  await page.getByRole("button", { name: "Save Note" }).focus();
  await nvda.press("Enter");
  await expect(box).toBeFocused({ timeout: 10_000 });
  await nvda.perform(nvda.keyboardCommands.reportCurrentFocus);
  const heard = await said(nvda);
  console.log("after saving:", heard);
  expect(heard).toContain("add your note");
});
