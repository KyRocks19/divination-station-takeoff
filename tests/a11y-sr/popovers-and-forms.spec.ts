import { nvdaTest as test } from "@guidepup/playwright";
import { expect } from "@playwright/test";
import { pass, said, signIn, toWebContent, user } from "./helpers";

test.beforeEach(async ({ page }) => {
  test.skip(!user || !pass, "Set A11Y_USER and A11Y_PASS to a dev-database test account");
  await signIn(page);
});

/** What NVDA says about the control that has focus right now. */
async function whatHasFocus(nvda: any): Promise<string> {
  await nvda.perform(nvda.keyboardCommands.reportCurrentFocus);
  await new Promise((r) => setTimeout(r, 400));
  return (await nvda.lastSpokenPhrase()).toLowerCase();
}

test("the New Reading menu is announced as a collapsible button, opens a list of links, and Escape returns to the button", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  // The header's button, which is on every page (the Readings page has its own as well).
  const button = page.getByRole("banner").getByRole("button", { name: /New Reading/ });
  await button.focus();

  const closed = await whatHasFocus(nvda);
  console.log("closed:", closed);
  expect(closed).toContain("new reading");
  expect(closed).toContain("button");
  expect(closed).toContain("collapsed");

  await nvda.press("Enter");
  await expect(button).toHaveAttribute("aria-expanded", "true");
  const open = await whatHasFocus(nvda);
  console.log("open:", open);
  expect(open).toContain("expanded");

  // The next Tab stop is the first way to begin, announced as a link.
  await nvda.press("Tab");
  await expect.poll(async () => (await nvda.lastSpokenPhrase()).toLowerCase(), { timeout: 6000 }).toContain("link");

  // Escape closes the list and focus goes back to the button.
  await nvda.press("Escape");
  await expect(button).toHaveAttribute("aria-expanded", "false");
  await expect(button).toBeFocused();
  const back = await whatHasFocus(nvda);
  console.log("back:", back);
  expect(back).toContain("new reading");
  expect(back).toContain("collapsed");
});

test("the feedback dialog is announced as a dialog with its title, and Escape returns to its button", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const button = page.getByRole("navigation", { name: "Main" }).getByRole("button", { name: "Send feedback" });
  await button.focus();
  await nvda.press("Enter");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("send feedback");
  const log = await said(nvda);
  console.log("feedback dialog:", log);
  expect(log).toContain("dialog");
  await nvda.press("Escape");
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("a text box with an error: NVDA reads its label, that it is invalid, and the error text", async ({ page, nvda }) => {
  await page.goto("/design", { waitUntil: "load" });
  await toWebContent(page, nvda);
  await page.locator("#d-count").focus();
  const spoken = await whatHasFocus(nvda);
  console.log("field with error:", spoken);
  expect(spoken).toContain("a short number box");
  expect(spoken).toContain("invalid");
  expect(spoken).toContain("an error sits under the box");
});

test("a text box with help: NVDA reads the help with the label", async ({ page, nvda }) => {
  await page.goto("/design", { waitUntil: "load" });
  await toWebContent(page, nvda);
  await page.locator("#d-name").focus();
  const spoken = await whatHasFocus(nvda);
  console.log("field with help:", spoken);
  expect(spoken).toContain("a text box");
  expect(spoken).toContain("help sits under the box");
});
