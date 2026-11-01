import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { NO_REALM, cleanSharedRealm, effectiveRealm, matchesRealm, realmChoices } from "../lib/concept-realm-core";
import { cleanConcept, MAX } from "../lib/own-archetypes-core";

test("a concept's own realm comes first, then its archetype's, then none", () => {
  assert.equal(effectiveRealm("Hearth things", "Home and family"), "Hearth things");
  assert.equal(effectiveRealm("  ", "Home and family"), "Home and family");
  assert.equal(effectiveRealm(null, undefined), null);
});

test("a shared concept's realm must be one of the twelve, or empty to take its archetype's again", () => {
  assert.deepEqual(cleanSharedRealm("Self"), { ok: true, value: "Self" });
  assert.deepEqual(cleanSharedRealm(""), { ok: true, value: null });
  assert.deepEqual(cleanSharedRealm(null), { ok: true, value: null });
  assert.equal(cleanSharedRealm("Made up").ok, false);
  assert.equal(cleanSharedRealm(3).ok, false);
});

test("the filter lists the shared realms in order, then the person's own A to Z, once each", () => {
  assert.deepEqual(realmChoices(["Zebra", "Self", null, "Beginnings and endings", "apple", "Self"]), ["Beginnings and endings", "Self", "apple", "Zebra"]);
});

test("the filter lets everything through, one realm, or only concepts without one", () => {
  assert.equal(matchesRealm("Self", ""), true);
  assert.equal(matchesRealm(null, ""), true);
  assert.equal(matchesRealm("Self", "Self"), true);
  assert.equal(matchesRealm("Bonds", "Self"), false);
  assert.equal(matchesRealm(null, NO_REALM), true);
  assert.equal(matchesRealm("Self", NO_REALM), false);
});

test("a person's own concept may name its own realm, in one line and within the limit", () => {
  const made = cleanConcept({ name: "Porch light", realm: "  Hearth\nthings " });
  assert.ok(made.ok && made.value.realm === "Hearth things");
  const none = cleanConcept({ name: "Porch light", realm: "" });
  assert.ok(none.ok && none.value.realm === null);
  assert.equal(cleanConcept({ name: "x", realm: "r".repeat(MAX.realm + 1) }).ok, false);
  assert.equal(cleanConcept({ name: "x", realm: 5 }).ok, false);
});

test("the realm core imports no database code, so the browser can use it", () => {
  const imports = [...readFileSync(new URL("../lib/concept-realm-core.ts", import.meta.url), "utf8").matchAll(/\bfrom\s+"([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(imports, ["./archetypes-data"]);
});

test("migration 101 adds the two columns safely and says older versions can open the data", () => {
  const sql = readFileSync(new URL("../migrations/101_concept_realms.sql", import.meta.url), "utf8");
  assert.match(sql, /ALTER TABLE concepts ADD COLUMN IF NOT EXISTS realm TEXT;/);
  assert.match(sql, /ALTER TABLE user_concepts ADD COLUMN IF NOT EXISTS realm TEXT;/);
  assert.match(sql, /^-- older-versions: ok$/m);
});
