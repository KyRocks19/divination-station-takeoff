/**
 * Lists the licence of every package that ships with the app (the "production" packages in package-lock.json, not the ones only used to build
 * and test), read from each package's own package.json in node_modules, and writes docs/third-party-licenses.md (open item ED19).
 *
 *   npx tsx scripts/list-licenses.ts            writes the file
 *   npx tsx scripts/list-licenses.ts --check    writes nothing; exits 1 if a package has no licence, a licence not on the list below, or the
 *                                               file is out of date (for the release check)
 *
 * It reads only files on this computer. It does not decide whether a licence is compatible with the AGPL: licences on the ALLOWED list are ones
 * the Free Software Foundation lists as compatible with GPL v3 (so with AGPL v3) or that are not copyright terms at all (public domain). Anything
 * else is printed under "To look at" for the owner. This is not legal advice.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");

/** SPDX ids the FSF lists as compatible with GPL v3, or public-domain dedications. Matched on each part of an "A OR B" or "A AND B" expression. */
const ALLOWED = new Set([
  "MIT", "MIT-0", "ISC", "BSD-2-Clause", "BSD-3-Clause", "0BSD", "Apache-2.0", "Zlib", "Unlicense", "CC0-1.0", "BlueOak-1.0.0", "Python-2.0",
  "SIL OFL 1.1", "OFL-1.1", "CC-BY-4.0", "WTFPL", "LGPL-3.0-or-later", "LGPL-3.0-only", "LGPL-2.1-or-later", "MPL-2.0", "GPL-3.0-or-later", "GPL-3.0-only", "AGPL-3.0-only", "AGPL-3.0-or-later",
]);

interface Pkg {
  name: string;
  version: string;
  license: string;
}

function licenseOf(json: any): string {
  const l = json.license ?? json.licenses;
  if (typeof l === "string") return l;
  if (l && typeof l === "object" && !Array.isArray(l) && typeof l.type === "string") return l.type;
  if (Array.isArray(l)) return l.map((x) => (typeof x === "string" ? x : x?.type)).filter(Boolean).join(" OR ");
  return "";
}

/** Whether every alternative of an SPDX-like expression has an allowed way through: for "A OR B" one allowed part is enough; for "A AND B" all are needed. */
export function allowedExpression(expr: string): boolean {
  const e = expr.replace(/[()]/g, " ").trim();
  if (!e) return false;
  return e.split(/\s+OR\s+/i).some((alt) => alt.split(/\s+AND\s+/i).every((id) => ALLOWED.has(id.trim())));
}

function collect(): Pkg[] {
  const lock = JSON.parse(readFileSync(join(root, "package-lock.json"), "utf8"));
  const out: Pkg[] = [];
  for (const [path, meta] of Object.entries<any>(lock.packages ?? {})) {
    if (!path.startsWith("node_modules/") || meta.dev || meta.devOptional) continue;
    const name = path.slice(path.lastIndexOf("node_modules/") + "node_modules/".length);
    const file = join(root, path, "package.json");
    const json = existsSync(file) ? JSON.parse(readFileSync(file, "utf8")) : {};
    out.push({ name, version: meta.version ?? json.version ?? "?", license: licenseOf(json) || licenseOf(meta) });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function render(pkgs: Pkg[]): string {
  const counts = new Map<string, number>();
  for (const p of pkgs) counts.set(p.license || "(none stated)", (counts.get(p.license || "(none stated)") ?? 0) + 1);
  const look = pkgs.filter((p) => !allowedExpression(p.license));
  const lines: string[] = [
    "# Third-party licences (generated)",
    "",
    "Made by `npx tsx scripts/list-licenses.ts` from `package-lock.json` and each package's own `package.json`. It lists the packages that ship with the app (not the ones used only to build and test). **Do not edit by hand: run the script again after the packages change.** This is a list of what each package says about itself; it is not legal advice and it does not replace the licence files the packages carry.",
    "",
    `${pkgs.length} packages.`,
    "",
    "## Counts by licence",
    "",
    "| Licence | Packages |",
    "|---|---|",
    ...[...counts.entries()].sort((a, b) => b[1] - a[1]).map(([l, n]) => `| ${l} | ${n} |`),
    "",
    "## To look at",
    "",
    look.length
      ? "Packages whose licence is not on the script's list of licences that the Free Software Foundation lists as compatible with GPL v3 (and so with AGPL v3). Each needs a person to read the licence and decide.\n\n" + look.map((p) => `- ${p.name} ${p.version}: ${p.license || "(none stated)"}`).join("\n")
      : "Nothing: every package states a licence on the script's compatible list.",
    "",
    "## Every package",
    "",
    "| Package | Version | Licence |",
    "|---|---|---|",
    ...pkgs.map((p) => `| ${p.name} | ${p.version} | ${p.license || "(none stated)"} |`),
    "",
  ];
  return lines.join("\n");
}

if (process.argv[1] && /list-licenses\.ts$/.test(process.argv[1].replace(/\\/g, "/"))) {
  const pkgs = collect();
  const text = render(pkgs);
  const target = join(root, "docs/third-party-licenses.md");
  if (process.argv.includes("--check")) {
    const look = pkgs.filter((p) => !allowedExpression(p.license));
    const stale = !existsSync(target) || readFileSync(target, "utf8").replace(/\r\n/g, "\n") !== text;
    if (look.length) console.log(`${look.length} package(s) to look at:\n` + look.map((p) => `  ${p.name} ${p.version}: ${p.license || "(none stated)"}`).join("\n"));
    if (stale) console.log("docs/third-party-licenses.md is out of date: run `npx tsx scripts/list-licenses.ts`.");
    process.exit(look.length || stale ? 1 : 0);
  }
  writeFileSync(target, text);
  const look = pkgs.filter((p) => !allowedExpression(p.license));
  console.log(`Wrote docs/third-party-licenses.md: ${pkgs.length} packages, ${look.length} to look at.`);
  for (const p of look) console.log(`  ${p.name} ${p.version}: ${p.license || "(none stated)"}`);
}
