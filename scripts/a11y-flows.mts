// Walks the app's main flows with the keyboard only, the way a screen-reader user would, and checks where focus goes after
// each step: it must never fall back to <body> (where a screen reader loses its place and the next Tab starts from the top).
// After each flow the page it ends on gets an axe run. It creates data (readings, draws, a card), so run it on a scratch copy.
//
// Start a local copy on a scratch folder first (as for smoke-pages.mts), then:
//   npx tsx scripts/a11y-flows.mts [--url http://localhost:3101] [--only tools,reading,nav]
// Prints one line per step (ok or a problem) and the result pages it made, which can go to a11y-audit.mts --extra.
// It cannot hear anything: what NVDA says is `npm run test:sr` on Windows (tests/a11y-sr/README.md).
import { chromium, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = (arg("--url") ?? "http://localhost:3101").replace(/\/$/, "");
const user = process.env.SMOKE_USER ?? "smoke-tester";
const password = process.env.SMOKE_PASSWORD ?? "smoke-tester-passphrase-1";
const only = arg("--only")?.split(",");

let problems = 0;
const made: string[] = [];
const ok = (s: string) => process.stdout.write(`ok\t${s}\n`);
const bad = (s: string) => {
  problems++;
  process.stdout.write(`PROBLEM\t${s}\n`);
};

async function focusInfo(page: Page) {
  return page.evaluate(() => {
    const el = document.activeElement as HTMLElement | null;
    if (!el || el === document.body) return { lost: true, text: "<body>" };
    const name = el.getAttribute("aria-label") ?? (el.innerText || (el as HTMLInputElement).value || el.tagName);
    return { lost: false, text: `${el.tagName.toLowerCase()} "${name.replace(/\s+/g, " ").trim().slice(0, 60)}"` };
  });
}

/** Waits for the page to settle, then checks focus is somewhere, and optionally that it matches. */
async function expectFocus(page: Page, step: string, want?: RegExp) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(400);
  const f = await focusInfo(page);
  if (f.lost) return bad(`${step}: focus fell to <body>`);
  if (want && !want.test(f.text)) return bad(`${step}: focus on ${f.text}, expected ${want}`);
  ok(`${step}: focus on ${f.text}`);
}

async function axe(page: Page, step: string) {
  const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa", "best-practice"]).analyze();
  for (const v of r.violations) bad(`${step}: axe ${v.id} (${v.impact}) ${v.nodes.slice(0, 2).map((n) => n.target.join(" ")).join(" | ")}`);
}

/** Presses a button with the keyboard: focus, then Enter. */
async function press(page: Page, name: string | RegExp) {
  const b = page.locator("main").getByRole("button", { name, exact: typeof name === "string" }).first();
  await b.focus();
  await page.keyboard.press("Enter");
}

async function signIn(page: Page) {
  await page.goto(`${base}/setup`);
  if (page.url().includes("/setup")) {
    await page.getByLabel("Choose a username").fill(user);
    await page.getByLabel("Choose a password or a passphrase").fill(password);
    await page.getByLabel("The password again").fill(password);
    await page.getByRole("button", { name: "Set up" }).press("Enter");
  } else {
    await page.goto(`${base}/login`);
    await page.getByLabel("Username").fill(user);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Enter" }).press("Enter");
  }
  await page.waitForURL((u) => !/^\/(setup|login)/.test(u.pathname), { timeout: 30_000 });
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: "I have read this" }).press("Enter");
    await page.waitForURL((u) => !u.pathname.startsWith("/welcome"), { timeout: 30_000 });
  }
}

/** The tools whose "new" page makes a draw with one button: the button's name is the page's heading. */
const ONE_PRESS = ["/runes/new", "/ogham/new", "/dice/new", "/iching/new", "/geomancy/new", "/pendulum/new", "/playingcards/new", "/signs/new", "/tea/new", "/blots/new"];

async function tools(page: Page) {
  for (const p of ONE_PRESS) {
    await page.goto(`${base}${p}`, { waitUntil: "networkidle" });
    const h1 = (await page.locator("main h1").first().innerText()).trim();
    const box = page.locator("main").getByRole("textbox").first();
    if (await box.count()) await box.fill("A keyboard test");
    const named = page.locator("main").getByRole("button", { name: h1, exact: true });
    const button = (await named.count()) ? named.first() : page.locator("main button[type=submit]").last();
    await button.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((u) => u.pathname !== p, { timeout: 15_000 }).catch(() => {});
    const now = new URL(page.url()).pathname;
    if (now === p) {
      bad(`${p}: pressing "${h1}" did not make a draw`);
      continue;
    }
    made.push(now);
    await expectFocus(page, `${p} → ${now}`, /^h1 /);
    await axe(page, now);
  }

  // Scrying: the form gives way to the surface; focus goes to the main button, then to the saved session's heading.
  await page.goto(`${base}/scrying/new`, { waitUntil: "networkidle" });
  await press(page, "Open the surface");
  await expectFocus(page, "scrying: surface opened", /I am done looking/);
  await press(page, "I am done looking");
  await page.waitForURL((u) => /^\/scrying\/\d+/.test(u.pathname), { timeout: 15_000 });
  made.push(new URL(page.url()).pathname);
  await expectFocus(page, "scrying: session saved", /^h1 /);

  // Oracle deck: a card added with Enter in its name box.
  await page.goto(`${base}/oracle`, { waitUntil: "networkidle" });
  await page.getByLabel("Name for a new card").fill("The kettle");
  await page.keyboard.press("Enter");
  await page.waitForURL((u) => /^\/oracle\/cards\/\d+/.test(u.pathname), { timeout: 15_000 });
  made.push(new URL(page.url()).pathname);
  await expectFocus(page, "oracle: card added", /^h1 /);
  await axe(page, "oracle card");
  await page.goto(`${base}/oracle/pulls/new`, { waitUntil: "networkidle" });
  await press(page, "Pull some cards");
  await page.waitForURL((u) => /^\/oracle\/pulls\/\d+/.test(u.pathname), { timeout: 15_000 }).catch(() => {});
  made.push(new URL(page.url()).pathname);
  await expectFocus(page, "oracle: pull made", /^h1 /);
  await axe(page, "oracle pull");
}

async function reading(page: Page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/readings/new`, { waitUntil: "networkidle" });
  await press(page, "Custom");
  await page.getByLabel("Position 1 name").fill("Now");
  await page.getByLabel("Your question or intention").fill("What helps?");
  await press(page, /^Draw for me/);
  await page.waitForURL((u) => /^\/readings\/\d+/.test(u.pathname), { timeout: 20_000 });
  const url = new URL(page.url()).pathname;
  made.push(url);
  await expectFocus(page, "tarot: reading drawn", /^h1 /);
  await axe(page, "reading");

  // Write what you sense first: sealing replaces the box; focus must stay in that part of the page.
  await page.getByLabel("What do you sense?").fill("Something about water");
  await page.getByRole("radio", { name: "Quite sure" }).check();
  await press(page, "Seal my words");
  await expectFocus(page, "guess first: words sealed");

  // A card in the spread is a button a screen reader can reach (not hidden inside a picture).
  const card = page.getByRole("button", { name: /show details$/ }).first();
  if (!(await card.count())) bad("reading: no card button exposed to assistive technology");
  else {
    await card.focus();
    await page.keyboard.press("Enter");
    await expectFocus(page, "reading: card details opened", /hide details/);
  }

  // A journal note: the button turns off while saving and stays off once the box is empty; focus goes back to the box.
  await page.getByLabel("Add your note").fill("A note by keyboard");
  await press(page, "Save Note");
  await page.waitForTimeout(1500);
  await expectFocus(page, "journal: note saved", /textarea|textbox/);

  // On a phone the two halves are tabs: the arrow keys move between them.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  const tab = page.getByRole("tab", { name: "Reading Spread" });
  await tab.focus();
  await page.keyboard.press("ArrowRight");
  const sel = await page.getByRole("tab", { name: /Journals/ }).getAttribute("aria-selected");
  const focused = await focusInfo(page);
  if (sel === "true" && /Journals/.test(focused.text)) ok("reading tabs: ArrowRight moves to Journals");
  else bad(`reading tabs: ArrowRight left aria-selected=${sel}, focus on ${focused.text}`);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}${url}`, { waitUntil: "networkidle" });
  if (await page.locator("[role=tabpanel]").count()) bad("reading: tab panels on a wide screen, where there are no tabs");
  else ok("reading: no orphan tab panels on a wide screen");
}

async function nav(page: Page) {
  // Phone: the drawer opens on Enter, closes on Escape, and focus returns to the Menu button.
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}/tarot`, { waitUntil: "networkidle" });
  const menu = page.getByRole("button", { name: "Menu" });
  await menu.focus();
  await page.keyboard.press("Enter");
  await expectFocus(page, "drawer opened", /Close menu/);
  await page.keyboard.press("Escape");
  await expectFocus(page, "drawer closed with Escape", /Menu/);

  // Esc twice to close a menu and then the drawer must not set off the quick exit.
  await page.keyboard.press("Enter");
  await page.waitForTimeout(300);
  const newReading = page.getByRole("dialog", { name: "Menu" }).getByRole("button", { name: /New Reading/ });
  if (await newReading.count()) {
    await newReading.focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(200);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(800);
    if (new URL(page.url()).pathname.startsWith("/snake")) bad("Esc to close a menu and then the drawer set off the quick exit");
    else ok("Esc closing a menu then the drawer does not set off the quick exit");
  }

  // Desktop: Ctrl+K opens the search window; Escape closes it and focus returns to the Search button.
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(`${base}/tarot`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Search" }).first().focus();
  await page.keyboard.press("Control+k");
  await expectFocus(page, "search opened with Ctrl+K", /input/);
  await page.keyboard.type("cups");
  await page.waitForTimeout(1200);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  if (await page.locator("dialog[open]").count()) await page.keyboard.press("Escape");
  await expectFocus(page, "search closed with Escape", /Search/);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  if (new URL(page.url()).pathname.startsWith("/snake")) bad("Esc to close search, then Esc again, set off the quick exit");
  else ok("Esc closing search then one more Esc does not set off the quick exit");

  // The skip link is the first stop and moves focus into the page.
  await page.goto(`${base}/tarot`, { waitUntil: "networkidle" });
  await page.keyboard.press("Tab");
  const first = await focusInfo(page);
  if (!/Skip to the page content/.test(first.text)) bad(`first Tab stop is ${first.text}, not the skip link`);
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  const inMain = await page.evaluate(() => !!document.activeElement?.closest("main"));
  if (inMain) ok("skip link moves the next Tab into the page");
  else bad("after the skip link, Tab did not land inside <main>");
}

async function main() {
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM ?? "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const context = await browser.newContext({ reducedMotion: "reduce" });
  await context.addInitScript("globalThis.__name = (f) => f");
  const page = await context.newPage();
  page.on("pageerror", (e) => bad(`uncaught error on ${new URL(page.url()).pathname}: ${e.message.slice(0, 160)}`));
  await signIn(page);
  const flows: Record<string, (p: Page) => Promise<void>> = { tools, reading, nav };
  for (const [name, run] of Object.entries(flows)) {
    if (only && !only.includes(name)) continue;
    try {
      await run(page);
    } catch (err) {
      bad(`${name}: stopped: ${(err as Error).message.split("\n")[0].slice(0, 200)}`);
    }
  }
  await browser.close();
  process.stdout.write(`\nPages made: ${made.join(",")}\n${problems ? `${problems} problem(s).` : "No problems found."}\n`);
  process.exitCode = problems ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
