import test from "node:test";
import assert from "node:assert/strict";
import { CONCEPT_WORDING } from "../lib/concept-wording-data";
import { aliasOf, applyConceptWording } from "../lib/concept-wording";
import { visibleClause } from "../lib/concept-visibility";

test("each concept appears once in the wording list", () => {
  const names = CONCEPT_WORDING.map((w) => w.name);
  assert.equal(new Set(names).size, names.length);
});

test("a concept is reworded or marked, never both hidden and reworded", () => {
  for (const w of CONCEPT_WORDING) {
    assert.ok(w.shownAs || w.sensitivity, `${w.name} changes nothing`);
    assert.ok(!(w.shownAs && w.sensitivity === "hidden"), `${w.name} is both reworded and hidden`);
  }
});

test("the new wordings are all different, and none keeps the old kind-of-person label", () => {
  const shown = CONCEPT_WORDING.flatMap((w) => (w.shownAs ? [w.shownAs] : []));
  assert.equal(new Set(shown.map((s) => s.toLowerCase())).size, shown.length);
  for (const s of shown) assert.doesNotMatch(s, /homosexual|deviance|bad mother|sociopath|bitch|womani[sz]er|wicked|gold-?digger/i);
});

test("the insults are hidden and the sexual and abuse words are behind the choice", () => {
  const by = (n: string) => CONCEPT_WORDING.find((w) => w.name === n);
  for (const n of ["slob", "loser", "deadbeat", "dim-witted", "stupidity"]) assert.equal(by(n)?.sensitivity, "hidden", n);
  for (const n of ["rape", "sexual abuse", "sex trafficking", "assault", "abuse", "murder", "sex", "promiscuity"]) assert.equal(by(n)?.sensitivity, "reveal", n);
});

test("the old name becomes a plain search word, without the flag or the hidden space", () => {
  assert.equal(aliasOf("\u{1F3F3}️‍\u{1F308}Homosexuality"), "Homosexuality");
  assert.equal(aliasOf("Abuse​"), "Abuse");
  assert.equal(aliasOf("Gold-Digger"), "Gold-Digger");
  assert.equal(aliasOf("LGBTQ+"), "LGBTQ+");
});

test("a person who has not turned sensitive meanings on sees no marked concept; one who has sees all but the hidden", () => {
  assert.equal(visibleClause(false), "c.sensitivity IS NULL");
  assert.equal(visibleClause(true), "c.sensitivity IS DISTINCT FROM 'hidden'");
});

interface Row { id: number; name: string; display_name: string; sensitivity: string | null; aliases: string[] }

/** A tiny stand-in for the concepts table that understands the four statements applyConceptWording sends. */
function fakeDb(rows: Row[]) {
  const run = async (sql: string, params: unknown[]) => {
    if (sql.startsWith("SELECT id, display_name, sensitivity, aliases")) return { rows: rows.filter((r) => r.name === params[0]) };
    if (sql.startsWith("SELECT 1 FROM concepts")) return { rows: rows.filter((r) => r.display_name.toLowerCase() === String(params[0]).toLowerCase() && r.id !== params[1]).map(() => ({ "?column?": 1 })) };
    if (sql.startsWith("UPDATE concepts SET display_name")) {
      const r = rows.find((x) => x.id === params[2])!;
      r.display_name = params[0] as string;
      r.aliases = params[1] as string[];
      return { rows: [] };
    }
    if (sql.startsWith("UPDATE concepts SET sensitivity")) {
      rows.find((x) => x.id === params[1])!.sensitivity = params[0] as string;
      return { rows: [] };
    }
    throw new Error("unexpected statement: " + sql);
  };
  return run;
}

test("applying the wording rewords, marks, keeps the old name as an alias, and can be run again", async () => {
  const rows: Row[] = [
    { id: 1, name: "deviance", display_name: "Deviance", sensitivity: null, aliases: [] },
    { id: 2, name: "rape", display_name: "rape", sensitivity: null, aliases: [] },
    { id: 3, name: "slob", display_name: "Slob", sensitivity: null, aliases: [] },
    { id: 4, name: "untouched", display_name: "Untouched", sensitivity: null, aliases: [] },
  ];
  const run = fakeDb(rows);
  const dry = await applyConceptWording(run, false);
  assert.equal(rows[0].display_name, "Deviance", "a dry run changes nothing");
  assert.ok(dry.renamed.length === 1 && dry.marked.length === 2);

  const first = await applyConceptWording(run, true);
  assert.equal(rows[0].display_name, "Nonconformity");
  assert.deepEqual(rows[0].aliases, ["Deviance"]);
  assert.equal(rows[1].sensitivity, "reveal");
  assert.equal(rows[2].sensitivity, "hidden");
  assert.equal(rows[3].sensitivity, null);
  assert.ok(first.missing.length > 0, "names this database lacks are reported");

  const again = await applyConceptWording(run, true);
  assert.equal(again.renamed.length, 0);
  assert.equal(again.marked.length, 0);
  assert.deepEqual(rows[0].aliases, ["Deviance"], "the alias is not added twice");
});

test("a new wording that is already another concept's name is reported and skipped", async () => {
  const rows: Row[] = [
    { id: 1, name: "deviance", display_name: "Deviance", sensitivity: null, aliases: [] },
    { id: 2, name: "nonconformity", display_name: "Nonconformity", sensitivity: null, aliases: [] },
  ];
  const report = await applyConceptWording(fakeDb(rows), true);
  assert.equal(rows[0].display_name, "Deviance");
  assert.equal(report.clashes.length, 1);
});
