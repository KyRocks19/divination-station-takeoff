import { nvdaTest as test } from "@guidepup/playwright";
import { expect } from "@playwright/test";

import { pass, said, signIn, toWebContent, user } from "./helpers";

test.beforeEach(async ({ page }) => {
  test.skip(!user || !pass, "Set A11Y_USER and A11Y_PASS to a dev-database test account");
  await signIn(page);
});

test("on a phone, NVDA announces the menu button, the drawer, and the way back", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  // Tab the way a keyboard user would, from the skip link to the Menu button (a few stops at most).
  for (let i = 0; i < 6 && !(await nvda.lastSpokenPhrase()).toLowerCase().includes("menu"); i++) {
    await nvda.press("Tab");
  }

  // The button is announced with its name, role and collapsed state.
  const onButton = (await nvda.lastSpokenPhrase()).toLowerCase();
  console.log("on the Menu button:", onButton);
  expect(onButton).toContain("menu");
  expect(onButton).toContain("button");
  expect(onButton).toContain("collapsed");

  // Opening it: the dialog is announced and focus lands on "Close menu".
  await nvda.press("Enter");
  await page.getByRole("dialog", { name: "Menu" }).waitFor();
  await expect(page.getByRole("button", { name: "Close menu" })).toBeFocused();
  // NVDA announces the dialog on its own; on a fresh dialog it may not speak the focused control, so ask it what has focus.
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("dialog");
  await nvda.perform(nvda.keyboardCommands.reportCurrentFocus);
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("close menu");
  console.log("after opening:", await said(nvda));

  // The current page is announced as the current page somewhere in the drawer.
  const here = page.getByRole("dialog").locator('[aria-current="page"]');
  await expect(here).toHaveText(/Readings/);

  // Escape closes it and puts focus back on the button.
  await nvda.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Menu" })).toBeFocused();
  // The page itself must say "collapsed" by now...
  await expect(page.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
  const spokenOnReturn = (await nvda.lastSpokenPhrase()).toLowerCase();
  console.log("spoken as focus returned:", spokenOnReturn);
  // ...and so must the screen reader when asked.
  await nvda.perform(nvda.keyboardCommands.reportCurrentFocus);
  const asked = (await nvda.lastSpokenPhrase()).toLowerCase();
  console.log("asked after closing:", asked);
  expect(asked).toContain("menu");
  expect(asked).toContain("collapsed");
});

test("on a desktop, the first stop is the skip link, and it moves focus into the page", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  // A fresh page, with NVDA at the top of it: the first thing it reaches must be the skip link.
  const first = (await nvda.lastSpokenPhrase()).toLowerCase();
  console.log("first stop:", first);
  expect(first).toContain("skip to the page content");
  await nvda.press("Enter");
  await expect(page.locator("main")).toBeFocused();
});

test("a tool's star: NVDA reads its name and state, and the change is announced", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // Start from every tool starred, so the test can be run again.
  await page.request.post("/api/prefs", { data: { tools: null } });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  // The star is not a Tab stop (Space on the tool's link does the same); a screen reader reaches it in browse mode.
  const star = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Star Runes" });
  await star.focus();
  await nvda.perform(nvda.keyboardCommands.reportCurrentFocus);
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("star runes");
  const before = await said(nvda);
  console.log("on the star:", before);
  expect(before).toContain("pressed");

  await nvda.press("Space");
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("runes taken out of your tools");
  await nvda.press("Space");
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("runes added to your tools");
  console.log("after two presses:", await said(nvda));
});
