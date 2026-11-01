import { nvdaTest as test } from "@guidepup/playwright";
import { expect } from "@playwright/test";
import { pass, said, signIn, toWebContent, user } from "./helpers";

// NVDA on the screens made in the security and circles sessions, the merged Settings button in the header, the "Jump to"
// links, and the search window (open item Q4). They check what is announced and where focus goes; they do not replace
// listening to the app yourself once. Written 2026-10-17, see docs/open-items.md section E.

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

test("the header's one Settings button is read with the person's name, 'Settings' and as a link", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const link = page.getByRole("banner").getByRole("link", { name: /Settings/ });
  await link.focus();
  const spoken = await whatHasFocus(nvda);
  console.log("header settings:", spoken);
  // NVDA spells out a name with digits ("a 11y 39e"), so only the start of it is checked.
  expect(spoken).toContain((user ?? "").toLowerCase().slice(0, 6));
  expect(spoken).toContain("settings");
  expect(spoken).toContain("administrator");
  expect(spoken).toContain("link");
});

test("Settings: 'I want to delete my account' moves focus to the password box, and Keep my account puts it back", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const open = page.getByRole("button", { name: "I want to delete my account" });
  await open.focus();
  await nvda.press("Enter");
  await expect(page.locator("#delete-password")).toBeFocused();
  const spoken = await whatHasFocus(nvda);
  console.log("delete, password box:", spoken);
  expect(spoken).toContain("your password");
  await page.getByRole("button", { name: "Keep my account" }).focus();
  await nvda.press("Enter");
  await expect(open).toBeFocused();
  expect(await whatHasFocus(nvda)).toContain("i want to delete my account");
});

test("Settings: recovery codes ask for the password with focus in the box, and Cancel returns to the button", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const open = page.locator("#recovery-open");
  await open.focus();
  await nvda.press("Enter");
  await expect(page.locator("#recovery-password")).toBeFocused();
  const spoken = await whatHasFocus(nvda);
  console.log("recovery, password box:", spoken);
  expect(spoken).toContain("your password");
  await page.getByRole("button", { name: "Cancel" }).focus();
  await nvda.press("Enter");
  await expect(open).toBeFocused();
});

test("Settings: a wrong current password is announced as an alert", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/settings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  await page.getByLabel("Current password").fill("not-the-password-1");
  await page.getByLabel("New password", { exact: true }).fill("another-pass-1234");
  await page.getByLabel("Confirm new password").fill("another-pass-1234");
  const submit = page.getByRole("button", { name: "Update Password" });
  await submit.focus();
  await nvda.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /incorrect/i })).toHaveCount(1);
  // Not asserted: in this NVDA setup a message that appears a moment after a server answer was not spoken, and neither was a
  // plain test message added to an empty live region. So what NVDA said is only printed. Listen to this once yourself.
  await new Promise((r) => setTimeout(r, 3000));
  console.log("wrong password, spoken:", (await said(nvda)).slice(-300));
});

test("/recover: a mismatch between the two new passwords is announced", async ({ page, nvda }) => {
  await page.context().clearCookies();
  await page.goto("/recover", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const boxes = page.locator("input");
  await boxes.nth(0).fill("nobody-here");
  await boxes.nth(1).fill("AAAA-BBBB-CCCC");
  await boxes.nth(2).fill("abcdefghijkl1");
  await boxes.nth(3).fill("different-pass1");
  await boxes.nth(3).focus();
  await nvda.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /different/i })).toHaveCount(1);
  await expect.poll(() => said(nvda), { timeout: 8000 }).toContain("different");
});

test("/circle: a code that does not work is announced, and the code box is read with its label", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/circle", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const code = page.locator("#circle-code");
  test.skip((await code.count()) === 0, "This test account is already in a circle, so there is no join form.");
  await code.focus();
  const spoken = await whatHasFocus(nvda);
  console.log("circle code box:", spoken);
  expect(spoken).toContain("code");
  await code.fill("AAAA-BBBB-CCCC");
  await page.locator('form input[type="checkbox"]').first().check();
  await page.getByRole("button", { name: "Join" }).focus();
  await nvda.press("Enter");
  await expect(page.getByRole("alert").filter({ hasText: /does not work/i })).toHaveCount(1);
  // Not asserted: in this NVDA setup a message that appears a moment after a server answer was not spoken, and neither was a
  // plain test message added to an empty live region. So what NVDA said is only printed. Listen to this once yourself.
  await new Promise((r) => setTimeout(r, 3000));
  console.log("wrong circle code, spoken:", (await said(nvda)).slice(-300));
});

test("the Library's 'Jump to' links: Archetypes lands the next Tab inside that section", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/library", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const nav = page.getByRole("navigation", { name: "On this page" });
  await expect(nav).toHaveCount(1);
  const link = nav.getByRole("link", { name: "Archetypes" });
  await link.focus();
  const spoken = await whatHasFocus(nvda);
  console.log("jump link:", spoken);
  expect(spoken).toContain("archetypes");
  expect(spoken).toContain("link");
  await nvda.press("Enter");
  await expect(page).toHaveURL(/#lib-archetypes$/);
  await nvda.press("Tab");
  await expect.poll(() => said(nvda), { timeout: 6000 }).toContain("shared archetypes");
});

test("the search window (Q4): Ctrl+K opens a dialog and combobox, the count is announced, Escape returns to the button", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/readings", { waitUntil: "load" });
  await toWebContent(page, nvda);
  const button = page.getByRole("banner").getByRole("button", { name: /Search/ });
  await button.focus();
  await nvda.press("Enter");
  await expect(page.locator("dialog[open]")).toHaveCount(1);
  const combo = page.getByRole("combobox");
  await expect(combo).toBeFocused();
  const opened = await whatHasFocus(nvda);
  console.log("search opened:", opened);
  expect(opened).toContain("search");
  expect(opened).toMatch(/combo box|edit/);

  await nvda.type("tarot");
  // The first search after the server starts can be slow in development, so wait for the list before listening for the count.
  await expect(page.getByRole("listbox", { name: "Results" })).toHaveCount(1, { timeout: 30000 });
  await expect(page.getByRole("status").filter({ hasText: /\d+ results?\./ })).toHaveCount(1);
  // Not asserted: in this NVDA setup the count of results was not spoken, and neither was a
  // plain test message added to an empty live region. So what NVDA said is only printed. Listen to this once yourself.
  await nvda.press("ArrowDown");
  // The chosen result is announced with its place in the list (this part works).
  await expect.poll(async () => (await nvda.lastSpokenPhrase()).toLowerCase(), { timeout: 6000 }).toMatch(/\d+ of \d+/);
  console.log("after ArrowDown:", await nvda.lastSpokenPhrase());
  await expect(combo).toBeFocused();

  // With a plain keyboard one Escape closes the window. NVDA keeps the first Escape for itself when it leaves the focus mode it
  // switched on for the text box, so a second one may be needed: that is NVDA's habit, not the page's.
  await nvda.press("Escape");
  if ((await page.locator("dialog[open]").count()) > 0) {
    console.log("search: the first Escape was used by NVDA, pressing it again");
    await nvda.press("Escape");
  }
  await expect(page.locator("dialog[open]")).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("the interviewer (answers stood in): the first question takes focus, and the finished reading is announced as saved", async ({ page, nvda }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  // The server's answer is replaced here, so no Claude key is needed and nothing is sent to Anthropic.
  await page.route("**/api/interview", async (route) => {
    const body = JSON.parse(route.request().postData() ?? "{}");
    if (body.phase === "questions") {
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ questions: ["What do you notice first?", "What does it remind you of?"] }) });
    }
    return route.fulfill({ status: 200, contentType: "text/plain", body: "A short stand-in reading of what you said." });
  });
  const draws = await (await page.request.get("/api/runes")).json();
  test.skip(!draws.length, "This test account has no rune draw; make one at /runes/new first.");
  await page.goto(`/runes/${draws[0].id}`, { waitUntil: "load" });
  await toWebContent(page, nvda);
  const start = page.getByRole("button", { name: /Interview me/ });
  await start.focus();
  await nvda.press("Enter");
  const first = page.getByLabel("What do you notice first?");
  await expect(first).toBeFocused();
  const spoken = await whatHasFocus(nvda);
  console.log("first question:", spoken);
  expect(spoken).toContain("what do you notice first");
  await nvda.type("A feeling of calm.");
  await page.getByRole("button", { name: "Read in context" }).focus();
  await nvda.press("Enter");
  const reading = page.getByRole("group", { name: "Your interview reading" });
  await expect(reading).toBeFocused();
  expect(await whatHasFocus(nvda)).toContain("your interview reading");
  // The group's name says "saved", so the finish is heard when focus lands on it (the separate "Saved" status was not spoken).
  expect(await whatHasFocus(nvda)).toContain("saved");
});
