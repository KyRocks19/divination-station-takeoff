// Prints which project checks apply to the current change, and scans it for secrets.
// Read-only. Usage: npx tsx scripts/changed-checks.ts [base]
//   no argument: the working tree against HEAD (what you are about to commit)
//   base:        every commit not on <base> (the branch before a push), e.g. origin/main
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { applicableChecks, scanForSecrets } from "../lib/changed-checks-core";

const git = (...args: string[]) => execFileSync("git", args, { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const lines = (s: string) => s.split("\n").filter(Boolean);

const base = process.argv[2];
const range = base ? [`${base}...HEAD`] : ["HEAD"];
const tracked = lines(git("diff", "--name-only", ...range));
const untracked = base ? [] : lines(git("ls-files", "--others", "--exclude-standard"));
const changed = [...new Set([...tracked, ...untracked])].filter((p) => !p.startsWith("node_modules/"));

const clientFiles = new Set<string>();
for (const p of changed) {
  if (!/\.(tsx|ts)$/.test(p)) continue;
  try {
    if (/^\s*["']use client["']/.test(readFileSync(p, "utf8").slice(0, 200))) clientFiles.add(p);
  } catch {
    /* deleted file */
  }
}

const added = lines(git("diff", "--unified=0", ...range))
  .filter((l) => l.startsWith("+") && !l.startsWith("+++"))
  .map((l) => l.slice(1));
for (const p of untracked) {
  try {
    added.push(...lines(readFileSync(p, "utf8")).slice(0, 5000));
  } catch {
    /* unreadable */
  }
}

process.stdout.write(`${changed.length} changed file(s)\n`);
const checks = applicableChecks(changed, clientFiles);
if (!checks.length) process.stdout.write("No extra checks apply beyond: tsc, npm test, npm run build.\n");
for (const c of checks) {
  process.stdout.write(`- ${c.check} (${c.why}; ${c.files.length} file(s), e.g. ${c.files[0]})\n`);
}
const secrets = scanForSecrets(added, changed);
process.stdout.write(secrets.length ? `SECRET SCAN: ${secrets.length} finding(s)\n${secrets.map((s) => `  ${s}`).join("\n")}\n` : "Secret scan: clean\n");
process.exitCode = secrets.length ? 1 : 0;
