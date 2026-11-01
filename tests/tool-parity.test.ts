import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DIVINATION_KINDS } from "../lib/divination-kinds";
import { TOOL_KINDS } from "../lib/companion-context-tools";
import { CLOTH_KINDS, KIND_HAS_FACING } from "../lib/cloth-core";

// docs/tool-parity.md records what each tool can do. These pin the two rows it changed on 2026-10-22, and the one deliberate exception.

test("the companion, interviewer and guide read every tool except blind-target practice (and the oracle, which has its own builder)", () => {
  const left = DIVINATION_KINDS.filter((k) => !(TOOL_KINDS as string[]).includes(k));
  assert.deepEqual(left.sort(), ["oracle", "remoteview"]);
});

test("no tool view the companion can read hides its panels", () => {
  for (const view of ["playingcards/DrawView", "charms/CastView", "signs/NoteView", "tea/TeaView", "blots/BlotView"]) {
    assert.doesNotMatch(readFileSync(`components/${view}.tsx`, "utf8"), /^\s+plain$/m, view);
  }
  assert.match(readFileSync("components/remoteview/TrialView.tsx", "utf8"), /^\s+plain$/m);
});

test("playing cards can be recorded on a cloth, face up or down", () => {
  assert.ok((CLOTH_KINDS as readonly string[]).includes("playingcards"));
  assert.equal(KIND_HAS_FACING.playingcards, true);
});

// Owner's request, 2026-10-31: tossing onto a cloth is its own tool (Tossing lots, /lots), and no reading page carries the cloth section.
const READING_VIEWS = [
  "app/readings/[id]/page.tsx",
  "components/runes/DrawView.tsx",
  "components/ogham/DrawView.tsx",
  "components/dice/ThrowView.tsx",
  "components/oracle/PullView.tsx",
  "components/playingcards/DrawView.tsx",
  "components/charms/CastView.tsx",
];

test("where items landed is recorded on the Tossing lots page, not on any reading page", () => {
  for (const view of READING_VIEWS) assert.doesNotMatch(readFileSync(view, "utf8"), /CastRecord/, view);
  assert.match(readFileSync("app/lots/[id]/page.tsx", "utf8"), /<CastRecord divinationId=\{reading\.id\} \/>/);
  assert.match(readFileSync("lib/cloths.ts", "utf8"), /d\.kind = ANY\(\$2::text\[\]\)/, "the list holds only tools with items");
});

test("a charm cast can be recorded on one of the person's cloths, and laid onto it as it fell", () => {
  assert.ok((CLOTH_KINDS as readonly string[]).includes("charms"));
  assert.equal(KIND_HAS_FACING.charms, true);
  const route = readFileSync("app/api/divinations/[id]/cloth/route.ts", "utf8");
  assert.match(route, /from_cast === true/);
  assert.match(route, /o\.kind !== "charms"/, "only a charm cast is laid as it fell");
  assert.match(readFileSync("lib/cloths.ts", "utf8"), /FROM charm_casts WHERE divination_id = \$1 AND user_id = \$2/);
});
