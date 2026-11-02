// Checks on the Feathered edition (docs/plan-feathered-edition.md): one person, no AI, no outgoing connections. Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { editionName, editionOf, featheredFrom, isHostMode, shapeOf } from "../lib/edition";
import { FEATHERED_HIDDEN_PREFIXES, LOCAL_HIDDEN_PREFIXES, hiddenIn, hiddenInFeathered } from "../lib/edition-features";
import { groupsFor, itemShown } from "../lib/nav-groups";
import { searchStatic } from "../lib/search-core";
import { createRng } from "../lib/rng";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

/** Every file under a folder, as paths relative to the repository. */
function walk(rel: string): string[] {
  return readdirSync(path.join(root, rel)).flatMap((name) => {
    const r = `${rel}/${name}`;
    return statSync(path.join(root, r)).isDirectory() ? walk(r) : [r];
  });
}

/** The address a route file answers, with [id] folders written as a sample id. */
const routePath = (file: string) => file.replace(/^app/, "").replace(/\/route\.ts$/, "").replace(/\[[^\]]+\]/g, "1");

test("the Feathered build is chosen by NEXT_PUBLIC_FEATHERED=1 only", () => {
  assert.equal(featheredFrom("1"), true);
  assert.equal(featheredFrom(" 1 "), true);
  for (const v of [undefined, "", "0", "true", "yes"]) assert.equal(featheredFrom(v), false, String(v));
});

test("a Feathered copy is a local copy for one person: never hosted, never host mode", () => {
  assert.equal(editionOf(undefined, true), "local");
  assert.equal(editionOf("hosted", true), "local");
  assert.equal(shapeOf("local", "host", true), "feathered");
  assert.equal(shapeOf(undefined, undefined, true), "feathered");
  assert.equal(isHostMode("host", "local", true), false);
  // The other editions are as they were.
  assert.equal(shapeOf("local", "host", false), "host");
  assert.equal(shapeOf("local", undefined, false), "local");
  assert.equal(shapeOf(undefined, undefined, false), "hosted");
});

test("the names a person sees: Feathered, Winged for the full local edition, none for the hosted site", () => {
  assert.equal(editionName("feathered"), "Feathered");
  assert.equal(editionName("local"), "Winged");
  assert.equal(editionName("host"), "Winged");
  assert.equal(editionName("hosted"), null);
});

test("Feathered hides everything a local copy hides, and the AI, the picture computers and passkeys", () => {
  for (const p of LOCAL_HIDDEN_PREFIXES) assert.ok(hiddenInFeathered(p), p);
  for (const p of ["/ask", "/api/interpret", "/api/companion/jobs/3", "/api/worker/hello", "/admin/workers", "/api/passkeys/2", "/api/auth/login/passkey/options", "/journals/new"]) {
    assert.ok(hiddenInFeathered(p), p);
  }
  for (const p of ["/", "/readings", "/readings/4", "/settings", "/journals", "/journals/4", "/api/auth/login", "/api/encyclopedia/concepts/3/description", "/api/oracle/cards/2/art", "/oracle/gallery", "/admin/log", "/api/local/backups"]) {
    assert.ok(!hiddenInFeathered(p), p);
  }
  // hiddenIn asks the same question when the build is Feathered, whatever DS_EDITION and DS_MODE say.
  assert.equal(hiddenIn("hosted", "/api/interpret", undefined, true), true);
  assert.equal(hiddenIn("local", "/forum", "host", true), true);
  assert.equal(hiddenIn("local", "/api/interpret", undefined, false), false);
});

test("every API route that talks to an AI or a picture computer answers \"not found\" in Feathered, or refuses inside its handler", () => {
  const ai = /from "@\/lib\/(claude-access|ai-stream|ai-client|companion-model|companion-run|companion-queue|image-tool|image-queue|worker-client|worker-tokens|studio-signal|circle-claude|claude-api)"|@anthropic-ai\/sdk/;
  // Routes that stay because they also do something that is not AI; each refuses the AI part itself when FEATHERED.
  const guarded = ["app/api/encyclopedia/concepts/[id]/description/route.ts"];
  const routes = walk("app/api").filter((f) => f.endsWith("/route.ts") && ai.test(read(f)));
  assert.ok(routes.length > 20, "the scan found the AI routes");
  for (const f of routes) {
    if (guarded.includes(f)) {
      assert.match(read(f), /if \(FEATHERED\) return/, f);
      continue;
    }
    assert.ok(hiddenInFeathered(routePath(f)), `${f} talks to an AI and is not hidden in Feathered`);
  }
});

test("every prefix in the Feathered list is a real page or route, so none is a typo", () => {
  for (const p of FEATHERED_HIDDEN_PREFIXES) {
    const page = path.join(root, "app", p);
    let found = false;
    try {
      found = statSync(page).isDirectory();
    } catch {
      found = false;
    }
    assert.ok(found, p);
  }
});

test("the Feathered navigation and search have no forum, circle, feedback, users or picture computers", () => {
  const ids = groupsFor(true, "feathered").flatMap((g) => g.items.map((i) => i.id));
  for (const gone of ["forum", "circle", "feedback", "users", "reports", "workers"]) assert.ok(!ids.includes(gone), gone);
  for (const kept of ["readings", "library", "guide", "about", "adminlog", "tool-tarot", "patterns"]) assert.ok(ids.includes(kept), kept);
  assert.ok(groupsFor(true, "local").flatMap((g) => g.items.map((i) => i.id)).includes("workers"), "Winged keeps the picture computers");
  const labels = searchStatic("picture computers", true, "feathered").flatMap((g) => g.items.map((i) => i.label));
  assert.ok(!labels.includes("Picture computers"));
  assert.equal(itemShown({ noFeathered: true }, true, "feathered"), false);
  assert.equal(itemShown({ noFeathered: true }, true, "local"), true);
});

test("random.org is answered by this computer in Feathered: no request is made", async () => {
  const real = globalThis.fetch;
  let asked = false;
  globalThis.fetch = (async () => {
    asked = true;
    throw new Error("no network in this test");
  }) as typeof fetch;
  try {
    const rng = await createRng("random.org", true);
    const n = rng();
    assert.ok(n >= 0 && n < 1);
    assert.equal(asked, false);
  } finally {
    globalThis.fetch = real;
  }
});

test("the AI components draw nothing in Feathered", () => {
  // The AI pieces ask useAiReady (components/AiReady.tsx), which is all false in Feathered (effectiveAiReady, tests/ai-ready.test.ts).
  for (const f of [
    "components/CompanionPanel.tsx",
    "components/GuidePanel.tsx",
    "components/InterviewPanel.tsx",
    "components/CompanionNoticed.tsx",
    "components/PatternQuestion.tsx",
    "components/CompanionFocusCard.tsx",
  ]) {
    assert.match(read(f), /return useAiReady\(\)\.(claude|companion) \? </, f);
  }
  for (const f of ["components/account/ClaudeTokens.tsx", "components/PasskeySettings.tsx"]) {
    assert.match(read(f), /return FEATHERED \? null : </, f);
  }
  // The Settings choice of random.org, the companion block and the picture maker are left out there too.
  const settings = read("app/settings/page.tsx");
  assert.match(settings, /!\(FEATHERED && value === "random\.org"\)/);
  assert.equal((settings.match(/\{ai\.pictures && \(/g) ?? []).length, 1);
  assert.equal((settings.match(/\{ai\.companion && \(/g) ?? []).length, 1);
});

test("the Feathered build registers no service worker", () => {
  assert.match(read("components/ServiceWorkerRegistration.tsx"), /if \(FEATHERED\) \{/);
});
