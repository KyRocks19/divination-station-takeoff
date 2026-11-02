// Checks on leaving out AI features that are not set up (lib/ai-ready-core.ts, owner request 2026-11-02). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { ALL_AI, NO_AI, adultOnlyThings, effectiveAiReady, verdictLifetimeMs } from "../lib/ai-ready-core";

const root = path.join(__dirname, "..");
const read = (f: string) => readFileSync(path.join(root, f), "utf8");

test("the Feathered build has no AI, whatever the server says", () => {
  assert.deepEqual(effectiveAiReady(ALL_AI, true), NO_AI);
  assert.deepEqual(effectiveAiReady(ALL_AI, false), ALL_AI);
  assert.deepEqual(effectiveAiReady(null, false), NO_AI);
  assert.deepEqual(effectiveAiReady({ claude: true, companion: false, pictures: true }, false), { claude: true, companion: false, pictures: true });
});

test("a key that works is trusted for longer than a refused key or no answer", () => {
  assert.ok(verdictLifetimeMs("ok") > verdictLifetimeMs("refused"));
  assert.ok(verdictLifetimeMs("refused") > verdictLifetimeMs("unchecked"));
});

test("the age setting names only the AI features this copy has", () => {
  const none = adultOnlyThings({ claude: false, companion: false });
  assert.doesNotMatch(none.intro + none.locked, /Claude|companion|AI/);
  const both = adultOnlyThings({ claude: true, companion: true });
  assert.match(both.intro, /Three things/);
  assert.match(both.intro, /the AI companion, and the buttons that ask Claude/);
  assert.equal(both.locked, "Saved. Sensitive meanings, the companion and the Claude buttons are locked.");
  const companion = adultOnlyThings({ claude: false, companion: true });
  assert.match(companion.intro, /Two things/);
  assert.doesNotMatch(companion.intro + companion.locked, /Claude/);
  const claude = adultOnlyThings({ claude: true, companion: false });
  assert.doesNotMatch(claude.intro + claude.locked, /companion/);
});

test("the root layout works out what is ready and hands it to every signed-in page", () => {
  const layout = read("app/layout.tsx");
  assert.match(layout, /aiReadyFor\(session\.userId\)/);
  assert.match(layout, /<AiReadyProvider ready=\{aiReady\}>/);
});

test("the Claude-only pages are not there without a Claude key that works", () => {
  for (const f of ["app/ask/page.tsx", "app/journals/new/layout.tsx"]) {
    assert.match(read(f), /if \(!\(await aiReadyFor\(session\.userId\)\)\.claude\) notFound\(\);/, f);
  }
});

test("no AI piece decides by FEATHERED alone any more", () => {
  const pieces: Record<string, RegExp> = {
    "components/CardDetail.tsx": /readingContext && ai\.claude && \(/,
    "components/layouts/LayoutEditor.tsx": /\{ai\.claude && \(/,
    "app/encyclopedia/[concept]/page.tsx": /!description && !generating && ai\.claude && \(/,
    "app/insights/page.tsx": /\{ai\.claude && <HieroPatternReading \/>\}/,
    "app/readings/[id]/page.tsx": /\{ai\.claude && \(/,
    "app/journals/page.tsx": /\{ai\.claude && \(/,
    "components/ReadingsTabWrapper.tsx": /tab === "ask" && claude && <AskContent/,
    "components/useCompanionJobs.ts": /const enabled = wanted && useAiReady\(\)\.companion;/,
    "components/oracle/SceneIdeas.tsx": /!prefs\.companionEnabled \|\| !ai\.companion/,
    "app/oracle/cards/[id]/page.tsx": /artHelp=\{ai\.pictures && prefs\.artHelp\}/,
  };
  for (const [f, re] of Object.entries(pieces)) assert.match(read(f), re, f);
});

test("the readiness check mirrors whose key a Claude route would use", () => {
  const src = read("lib/ai-ready.ts");
  // A circle's key, when there is one, is the only key tried (lib/claude-access.ts never falls back to the app's key).
  assert.match(src, /if \(circle\) return "apiKey" in circle \? keyWorks\(circle\.apiKey\) : false;/);
  assert.match(src, /process\.env\.ANTHROPIC_API_KEY/);
  // A hosted copy keeps every feature as before.
  assert.match(src, /if \(editionOf\(\) !== "local"\) return ALL_AI;/);
});
