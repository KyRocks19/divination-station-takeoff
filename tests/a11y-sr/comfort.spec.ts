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

test("Reading comfort: entering a group names it, the arrow keys choose, and the page changes at once", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  // Start from the standard page whatever an earlier run left behind.
  await page.evaluate(() => localStorage.removeItem("ds-comfort"));
  await page.reload({ waitUntil: "load" });
  await toWebContent(page, nvda);

  // Tab from the last font choice into the size group, the way a keyboard user arrives: NVDA names the group, then the
  // checked choice in it.
  await page.getByRole("radio", { name: /^My device's own font/ }).focus();
  await nvda.press("Tab");
  // NVDA names the group as focus enters it; asked what has focus, it reads the checked choice in full.
  await expect.poll(() => said(nvda), { timeout: 8000 }).toContain("text size");
  const entering = await whatHasFocus(nvda);
  console.log("on entering the size group:", entering);
  expect(entering).toContain("standard");
  expect(entering).toContain("radio button");
  expect(entering).toContain("checked");

  // The arrow keys move through the choices and choose each one; three steps reach "Largest".
  for (let i = 0; i < 3; i++) await nvda.press("ArrowRight");
  await expect(page.locator("html")).toHaveAttribute("data-size", "150");
  const after = await whatHasFocus(nvda);
  console.log("after choosing:", after);
  expect(after).toContain("largest");
  expect(after).toContain("radio button");
  expect(after).not.toContain("not checked");

  // Leave the page as we found it.
  await page.getByRole("button", { name: "Back to standard" }).click();
  await expect(page.locator("html")).not.toHaveAttribute("data-size", /.*/);
});
