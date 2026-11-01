// Scans every commit on every branch for secrets and personal material (ED12).
// Read-only. Prints the commit, file and kind of each finding, never the value.
// Usage: npx tsx scripts/scan-history.ts [--personal]
//   A shallow clone sees only part of the history: run `git fetch --unshallow` first.
//   --personal also lists personal material (tailnet names, Neon hosts, user folders).
import { execFileSync } from "node:child_process";
import { scanHistoryPatch } from "../lib/changed-checks-core";

const git = (...args: string[]) =>
  execFileSync("git", args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 1024 });

if (git("rev-parse", "--is-shallow-repository").trim() === "true") {
  process.stdout.write("This clone is shallow, so older commits are missing. Run: git fetch --unshallow\n");
  process.exitCode = 2;
} else {
  const showPersonal = process.argv.includes("--personal");
  const commits = git("rev-list", "--all").split("\n").filter(Boolean).length;
  const patch = git("log", "--all", "-p", "--unified=0", "--no-color", "--no-ext-diff", "--format=commit:%H");
  const findings = scanHistoryPatch(patch);
  const secrets = findings.filter((f) => f.kind === "secret");
  const personal = findings.filter((f) => f.kind === "personal");

  process.stdout.write(`${commits} commit(s) scanned on every branch.\n`);
  if (secrets.length) {
    process.stdout.write(`SECRETS: ${secrets.length} finding(s). Rotate the key, then publish from a fresh history.\n`);
    for (const f of secrets) process.stdout.write(`  ${f.commit.slice(0, 9)}  ${f.label}  ${f.path}\n`);
  } else {
    process.stdout.write("Secrets: none found.\n");
  }
  const byPath = new Map<string, Set<string>>();
  for (const f of personal) byPath.set(f.path, (byPath.get(f.path) ?? new Set()).add(f.label));
  process.stdout.write(`Personal material: ${byPath.size} file(s) at some point in history.\n`);
  if (showPersonal) {
    for (const [p, labels] of [...byPath].sort()) process.stdout.write(`  ${p}  (${[...labels].join(", ")})\n`);
  }
  process.exitCode = secrets.length ? 1 : 0;
}
