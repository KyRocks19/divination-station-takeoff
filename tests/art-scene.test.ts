import { test } from "node:test";
import assert from "node:assert/strict";
import {
  COMPOSITION,
  SCENE_WORD_LIMIT,
  STYLE_PRESETS,
  composeScene,
  compositionFor,
  defaultSelection,
  sceneSources,
  tidyScene,
  wordCount,
  type SceneCard,
} from "../lib/art-scene";
import { limitsFor, DISK_MAX_BYTES, MAX_UPLOAD_BYTES } from "../lib/oracle-art";

const card: SceneCard = {
  name: "Choice",
  origin: "conflict, alliance, self-recognition, pivot, turning point",
  fields: [
    { id: 1, name: "memory_scene", value: "Ky and Kylie fighting with swords, the whole system behind them" },
    { id: 2, name: "song", value: "" },
    { id: 3, name: "colour", value: null },
  ],
  meanings: [
    { id: 10, label: null, content: "Keywords: conflict, alliance, self-recognition, pivot, turning point. Description: The moment a choice is made" },
    { id: 11, label: "Shadow", content: "  " },
    { id: 12, label: "Light", content: "Standing together" },
  ],
};

test("every piece of the person's writing is offered, and empty ones are not", () => {
  const sources = sceneSources(card);
  assert.deepEqual(sources.map((s) => s.id), ["name", "origin", "field-1", "meaning-10", "meaning-12"]);
  assert.equal(sources.find((s) => s.id === "field-1")?.label, "memory_scene");
  assert.equal(sources.find((s) => s.id === "meaning-10")?.label, "Meaning", "an unlabelled meaning is called Meaning");
  assert.equal(sources.find((s) => s.id === "meaning-12")?.label, "Light");
});

test("the name and where it comes from start ticked; fields and meanings start unticked", () => {
  assert.deepEqual(defaultSelection(sceneSources(card)), ["name", "origin"]);
});

test("with no 'where it comes from', the first meaning starts ticked instead", () => {
  const sources = sceneSources({ ...card, origin: null });
  assert.deepEqual(defaultSelection(sources), ["name", "meaning-10"]);
});

test("repeated phrases and a leading Keywords label are cleaned out, and nothing is added", () => {
  const sources = sceneSources(card);
  const scene = composeScene(sources, ["name", "origin", "meaning-10"]);
  assert.equal(scene, "Choice. conflict, alliance, self-recognition, pivot, turning point. The moment a choice is made");
  assert.ok(!/keywords|description/i.test(scene));
  // Each phrase appears once.
  assert.equal(scene.match(/conflict/g)?.length, 1);
});

test("the scene follows the ticked sources in the order they appear on the item", () => {
  const sources = sceneSources(card);
  assert.equal(composeScene(sources, ["meaning-12", "name"]), "Choice. Standing together");
  assert.equal(composeScene(sources, []), "");
});

test("tidying keeps sentences, ignores capitals and punctuation when finding repeats, and is stable", () => {
  assert.equal(tidyScene("A lantern. a LANTERN!, a path"), "A lantern. a path");
  assert.equal(tidyScene("one, two,, two ,three"), "one, two, three");
  assert.equal(tidyScene("Keywords: red, blue; Description: red sky"), "red, blue. red sky");
  const once = tidyScene("Choice. conflict, alliance, conflict. The moment");
  assert.equal(tidyScene(once), once);
  assert.equal(tidyScene(""), "");
  assert.ok(tidyScene("word, ".repeat(2000) + "end").length <= 1000);
});

test("word counts and the word limit", () => {
  assert.equal(wordCount(""), 0);
  assert.equal(wordCount("  one   two\nthree "), 3);
  assert.ok(SCENE_WORD_LIMIT >= 40 && SCENE_WORD_LIMIT <= 77);
});

test("each form has composition words and the presets only describe a look", () => {
  for (const form of ["cards", "stones", "staves", "charms"] as const) {
    assert.ok(COMPOSITION[form].length > 10);
    assert.equal(compositionFor(form), COMPOSITION[form]);
  }
  assert.equal(compositionFor("nonsense"), COMPOSITION.cards);
  assert.ok(STYLE_PRESETS.length >= 6);
  const ids = new Set(STYLE_PRESETS.map((p) => p.id));
  assert.equal(ids.size, STYLE_PRESETS.length, "preset ids are unique");
  // A look never names a meaning: none of these words belongs in a preset.
  for (const p of STYLE_PRESETS) assert.ok(!/\b(meaning|means|symbol(?:ises|izes)?|represents)\b/i.test(p.text), p.id);
});

test("pictures kept on disk may be larger than pictures kept in the database", () => {
  assert.deepEqual(limitsFor(false), { maxBytes: MAX_UPLOAD_BYTES, longest: 1000 });
  assert.deepEqual(limitsFor(true), { maxBytes: DISK_MAX_BYTES, longest: 2400 });
  assert.ok(limitsFor(true).maxBytes > limitsFor(false).maxBytes);
});
