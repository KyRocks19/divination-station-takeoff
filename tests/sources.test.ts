import test from "node:test";
import assert from "node:assert/strict";
import { CITES, KINDS_WITHOUT_GUIDE, SOURCES, TOOL_GUIDES, getSource, homeToolOf, sourcesPath, type ToolGuideId } from "../lib/sources";
import { DIVINATION_KINDS } from "../lib/divination-kinds";
import { DICE_HISTORY } from "../lib/dice-data";
import { TOOL_ORIGINS } from "../lib/tool-origins";

test("every source has a unique id, a secure link, and all three tests filled in", () => {
  const ids = new Set<string>();
  for (const s of SOURCES) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.match(s.url, /^https:\/\//, `${s.id} link`);
    for (const key of ["lists", "record", "magick"] as const) {
      assert.ok(s[key].note.length > 10, `${s.id} ${key} note`);
    }
    assert.ok(s.cite.length > 20 && s.about.length > 20 && s.short.length > 3, `${s.id} text`);
  }
});

test("every tool has a guide and starts with two or three sources", () => {
  for (const kind of DIVINATION_KINDS) {
    // The few tools that are the app's own design or a log have no guide (KINDS_WITHOUT_GUIDE); every tool with a tradition must have one.
    if ((KINDS_WITHOUT_GUIDE as readonly string[]).includes(kind)) {
      assert.equal((TOOL_GUIDES as Record<string, unknown>)[kind], undefined, `${kind} has no guide`);
      continue;
    }
    const g = TOOL_GUIDES[kind as ToolGuideId];
    assert.ok(g, `${kind} guide`);
    assert.ok(g.start.length >= 2 && g.start.length <= 3, `${kind} start list has ${g.start.length}`);
    assert.ok(g.survives.length > 0 && g.conjecture.length > 0, `${kind} says what survives and what is conjecture`);
  }
  assert.ok(TOOL_GUIDES.across);
});

test("every id a guide or a marker names is a real source", () => {
  for (const [tool, g] of Object.entries(TOOL_GUIDES)) {
    for (const id of [...g.start, ...g.record, ...g.more]) assert.ok(getSource(id), `${tool} names ${id}`);
  }
  for (const [topic, ids] of Object.entries(CITES)) {
    for (const id of ids) assert.ok(getSource(id), `${topic} names ${id}`);
  }
});

test("a source named in a tool's start list is not also in its record or more lists", () => {
  for (const [tool, g] of Object.entries(TOOL_GUIDES)) {
    for (const id of [...g.record, ...g.more]) {
      assert.ok(!g.start.includes(id), `${tool} lists ${id} twice`);
    }
  }
});

test("the dice history and the world map point at topics that exist", () => {
  for (const s of DICE_HISTORY) if (s.topic) assert.ok(CITES[s.topic], `dice topic ${s.topic}`);
  for (const o of TOOL_ORIGINS) assert.ok(CITES[`origin.${o.id}`], `origin ${o.id}`);
});

test("a marker links to the tool where the source is listed", () => {
  assert.equal(sourcesPath("runes", "page-1987"), "/sources/runes#page-1987");
  assert.equal(sourcesPath(), "/sources");
  assert.equal(homeToolOf("page-1987", "runes"), "runes");
  assert.equal(homeToolOf("smith-1991", "dice"), "dice");
  // A source listed under another tool still resolves to the first place it appears.
  assert.equal(homeToolOf("wicked-pack-1996", "oracle"), "oracle");
  assert.equal(homeToolOf("wicked-pack-1996"), "tarot");
});
