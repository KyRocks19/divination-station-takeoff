import { test } from "node:test";
import assert from "node:assert/strict";
import { decide } from "../.claude/hooks/guard-bash.mjs";

// The push guard either asks or refuses (PUSH_DECISION); either way the command does not run unquestioned.
const blocksPush = (c: string) => ["ask", "deny"].includes(decide(c, "push")?.decision ?? "");

test("git push is refused, however it is spelled", () => {
  for (const c of [
    "git push",
    "git push origin main",
    "git push -u origin feature/circles",
    "git -C /repo push",
    "git --no-pager push",
    "cd x && git push",
    "git add -A; git commit -m x; git push",
    "FOO=1 git push",
    "if true; then git push; fi",
    "git status | cat\ngit push --force",
  ]) {
    assert.ok(blocksPush(c), c);
  }
});

test("other git commands, and the word push inside text, are left alone", () => {
  for (const c of [
    "git status",
    "git commit -m \"Never git push without asking\"",
    "git log --oneline -5",
    "git pull",
    "echo git push",
    "grep -rn \"git push\" docs",
    "git stash push",
    "npm run build",
    "",
  ]) {
    // `git stash push` is not a push to a remote, but it would be caught by a looser rule; it must not be refused.
    assert.equal(blocksPush(c), false, c);
  }
});

test("the push guard says why, and the live guard says nothing about push", () => {
  assert.match(decide("git push", "push")!.reason, /This is a `git push`/);
  assert.equal(decide("git push", "live"), null);
});

// Made-up endpoint names, so the test does not depend on this computer's env files.
const HOSTS = { dev: "ep-your-dev-branch-123456", live: "ep-your-live-db-654321" };
const denies = (c: string) => decide(c, "live", HOSTS)?.decision === "deny";

test("migrations, restores and seeds with no sign they aim at the dev branch are refused", () => {
  for (const c of [
    "npm run migrate",
    "npm run migrate 2>&1 | tail -15",
    "npx tsx scripts/migrate.ts",
    "npx tsx scripts/seed-symbol-archetypes.ts",
    "npx tsx scripts/seed-encyclopedia.ts",
    "npm run restore -- --file x.jsonl.gz",
    "npx tsx scripts/move-art-to-disk.ts",
    "cd app && npm run migrate",
  ]) {
    assert.ok(denies(c), c);
  }
});

test("the same commands are fine when they are aimed at the dev branch", () => {
  const dev =
    "export DATABASE_URL=\"$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2-)\" && H=\"$(echo \"$DATABASE_URL\" | sed -E 's#.*@([^/:?]+).*#\\1#')\" && case \"$H\" in ep-your-dev-branch*) npm run migrate;; esac";
  assert.equal(decide(dev, "live", HOSTS), null);
  assert.equal(decide("DATABASE_URL=postgres://u@ep-your-dev-branch-123456.neon.tech/db npx tsx scripts/seed-symbol-archetypes.ts", "live", HOSTS), null);
});

test("a dry run reads only, so it is not refused; --allow-live and the live host always are", () => {
  assert.equal(decide("npx tsx scripts/seed-encyclopedia.ts --dry-run", "live", HOSTS), null);
  assert.ok(denies("npx tsx scripts/seed-symbol-archetypes.ts --allow-live"));
  assert.ok(denies("npx tsx scripts/seed-symbol-archetypes.ts --dry-run --allow-live"));
  assert.ok(denies("DATABASE_URL=postgres://u@ep-your-live-db-654321.neon.tech/db npm run migrate"));
  assert.ok(denies("export DATABASE_URL=x # .env.development.local ep-your-live-db-654321\nnpm run migrate"));
});

test("commands that only read, build, test or serve are left alone", () => {
  for (const c of [
    "npm test",
    "npm run build",
    "npm run dev",
    "npm run backup -- --art-dir C:/x",
    "npx tsc --noEmit",
    "node check-migrations.mjs",
    "ls migrations",
    "git add migrations/064_pendulum_finer.sql",
    "cat docs/open-items.md",
    "grep -rn 'npm run migrate' docs",
    "echo 'then run npm run migrate yourself'",
    "git commit -m \"Run npm run migrate on dev first, scripts/seed-encyclopedia.ts later\"",
    "cat > msg.txt <<'EOF'\nMigration 064 is owed: npm run migrate on live\nEOF",
    "git commit -F msg.txt  # message mentions --allow-live and ep-your-live-db-654321",
    "cat > msg.txt <<'EOF'\n- refuses anything with --allow-live\nEOF\ngit add x && git commit -F msg.txt",
  ]) {
    assert.equal(denies(c), false, c);
  }
});

test("the words --dry-run elsewhere in the command do not excuse a real write", () => {
  assert.ok(denies("echo --dry-run && npm run migrate"));
  assert.ok(denies("npx tsx scripts/seed-encyclopedia.ts --dry-run; npx tsx scripts/seed-archetypes.ts"));
});

test("empty, missing or odd input says nothing", () => {
  assert.equal(decide("", "push"), null);
  assert.equal(decide(undefined, "live"), null);
  assert.equal(decide(42, "push"), null);
  assert.equal(decide("git push", "nonsense"), null);
});
