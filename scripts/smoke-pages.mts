// Visits every page of a running copy at a phone width and a desktop width and prints one line per problem: a page that fails
// to load, an error in the browser console, sideways scrolling, and serious or critical axe findings. It replaces the hand-written
// browser run at the end of each slice. Read-only apart from the first-run account it makes on a fresh local copy.
//
// Start a local copy on a scratch folder first (before-you-code, section 0):
//   DS_EDITION=local DS_DB_DIR=<scratch> SESSION_SECRET=<32+ chars> npm run build
//   DS_EDITION=local DS_DB_DIR=<scratch> SESSION_SECRET=<same> npx next start -p 3101
// Then: npx tsx scripts/smoke-pages.mts [--url http://localhost:3101] [--only /tarot,/runes] [--json out.json]
// A fresh folder gets the account smoke-tester (password below). An existing one: set SMOKE_USER and SMOKE_PASSWORD.
import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chromium, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

const arg = (name: string) => {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const base = (arg("--url") ?? "http://localhost:3101").replace(/\/$/, "");
const user = process.env.SMOKE_USER ?? "smoke-tester";
const password = process.env.SMOKE_PASSWORD ?? "smoke-tester-passphrase-1";
const WIDTHS = [390, 1280];

/** Every page under app/ without a [segment] in its path: the ones that can be opened without knowing an id. */
function staticPages(dir = "app", prefix = ""): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (!statSync(full).isDirectory()) {
      if (name === "page.tsx") out.push(prefix || "/");
      continue;
    }
    if (name === "api" || name.startsWith("[") || name.startsWith("_")) continue;
    out.push(...staticPages(full, name.startsWith("(") ? prefix : `${prefix}/${name}`));
  }
  return out.sort();
}

// Pages that are about signing in, or that only make sense before an account exists.
const SIGNED_OUT = new Set(["/login", "/setup", "/recover", "/join"]);

async function signIn(page: Page) {
  await page.goto(`${base}/setup`);
  if (page.url().includes("/setup")) {
    await page.getByLabel("Choose a username").fill(user);
    await page.getByLabel("Choose a password or a passphrase").fill(password);
    await page.getByLabel("The password again").fill(password);
    await page.getByRole("button", { name: "Set up" }).click();
    // A locked copy (locking is chosen for you on the first screen) shows its recovery codes on the same page first.
    const saved = page.getByRole("button", { name: "I have saved them" });
    await saved.or(page.getByRole("button", { name: "I have read this" })).first().waitFor({ timeout: 30_000 }).catch(() => {});
    if (await saved.isVisible()) await saved.click();
    await page.waitForURL((u) => !u.pathname.startsWith("/setup"), { timeout: 30_000 });
  } else {
    await page.goto(`${base}/login`);
    await page.getByLabel("Username").fill(user);
    await page.getByLabel("Password", { exact: true }).fill(password);
    await page.getByRole("button", { name: "Enter" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
  }
  if (page.url().includes("/welcome")) {
    await page.getByRole("button", { name: "I have read this" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/welcome"), { timeout: 30_000 });
  }
}

type Finding = { page: string; width: number; kind: string; detail: string };

async function main() {
  const only = arg("--only")?.split(",");
  const pages = (only ?? staticPages()).filter((p) => !SIGNED_OUT.has(p));
  const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM ?? "/opt/pw-browsers/chromium" }).catch(() => chromium.launch());
  const findings: Finding[] = [];
  const context = await browser.newContext();
  const page = await context.newPage();
  await signIn(page);

  for (const width of WIDTHS) {
    await page.setViewportSize({ width, height: width < 600 ? 844 : 900 });
    for (const p of pages) {
      const errors: string[] = [];
      const onConsole = (m: { type: () => string; text: () => string }) => {
        // A failed request is reported below with its address, which this message leaves out.
        if (m.type() === "error" && !m.text().startsWith("Failed to load resource")) errors.push(m.text().slice(0, 160));
      };
      const onResponse = (r: { status: () => number; url: () => string }) => {
        if (r.status() >= 400 && !r.url().endsWith(p)) errors.push(`request ${r.status()}: ${r.url().replace(base, "").slice(0, 160)}`);
      };
      const onPageError = (e: Error) => errors.push(`uncaught: ${e.message.slice(0, 160)}`);
      page.on("console", onConsole);
      page.on("pageerror", onPageError);
      page.on("response", onResponse);
      try {
        const res = await page.goto(`${base}${p}`, { waitUntil: "networkidle", timeout: 30_000 });
        const status = res?.status() ?? 0;
        if (status >= 400 && status !== 404) findings.push({ page: p, width, kind: "status", detail: String(status) });
        if (status === 404) {
          // A page hidden on this edition (lib/edition-features.ts) answers 404 on purpose.
          continue;
        }
        const sideways = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
        if (sideways > 1) findings.push({ page: p, width, kind: "sideways scroll", detail: `${sideways}px` });
        const axe = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze();
        for (const v of axe.violations.filter((v) => v.impact === "serious" || v.impact === "critical")) {
          findings.push({ page: p, width, kind: `axe ${v.id}`, detail: `${v.nodes.length} element(s): ${v.nodes[0]?.target.join(" ")}` });
        }
      } catch (err) {
        findings.push({ page: p, width, kind: "did not load", detail: (err as Error).message.split("\n")[0].slice(0, 160) });
      } finally {
        page.off("console", onConsole);
        page.off("pageerror", onPageError);
        page.off("response", onResponse);
      }
      for (const e of [...new Set(errors)]) findings.push({ page: p, width, kind: "console error", detail: e });
    }
  }
  await browser.close();

  process.stdout.write(`${pages.length} page(s) at ${WIDTHS.join(" and ")} px on ${base}\n`);
  if (!findings.length) process.stdout.write("No problems found.\n");
  for (const f of findings) process.stdout.write(`${f.page}\t${f.width}\t${f.kind}\t${f.detail}\n`);
  const json = arg("--json");
  if (json) writeFileSync(json, JSON.stringify(findings, null, 2));
  process.exitCode = findings.length ? 1 : 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(2);
});
