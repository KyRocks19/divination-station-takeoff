import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CHECK_OUT, PRIMARY_SOURCES, SECONDARY_SOURCES, getPrimarySource, primaryHref } from "../lib/primary-sources";

test("the primary sources keep the owner's order", () => {
  assert.deepEqual(
    PRIMARY_SOURCES.slice(0, 4).map((s) => s.id),
    ["radin", "planet-weird", "pollack", "cross"]
  );
});

test("every primary source has a unique id, a secure link, its texts and a note on how it was checked", () => {
  const ids = new Set<string>();
  for (const s of [...PRIMARY_SOURCES, ...SECONDARY_SOURCES]) {
    assert.ok(!ids.has(s.id), `duplicate id ${s.id}`);
    ids.add(s.id);
    assert.match(s.id, /^[a-z0-9-]+$/, `${s.id} is safe in a link`);
    assert.match(s.url, /^https:\/\//, `${s.id} link`);
    for (const k of ["name", "work", "cite", "urlLabel", "about", "basis"] as const) assert.ok(s[k].trim().length > 3, `${s.id} ${k}`);
    assert.equal(getPrimarySource(s.id), s);
  }
});

test("every listed link is secure and unique within its source", () => {
  for (const s of PRIMARY_SOURCES) {
    const seen = new Set<string>();
    for (const g of s.groups ?? []) {
      assert.ok(g.links.length > 0, `${g.id} has links`);
      for (const l of g.links) {
        assert.match(l.url, /^https:\/\//, l.label);
        assert.ok(!seen.has(l.url), `${l.url} listed twice`);
        seen.add(l.url);
      }
    }
  }
});

test("Planet Weird lists Haunted Objects Podcast episode 20 and both seasons of Hellier in full", () => {
  const pw = getPrimarySource("planet-weird");
  assert.ok(pw?.groups);
  const all = pw.groups.flatMap((g) => g.links);
  assert.ok(all.some((l) => l.url === "https://www.youtube.com/watch?v=4If0bh-xmVk" && /Episode 20/.test(l.label)));
  assert.equal(pw.groups.find((g) => g.id === "hellier-season-1")?.links.length, 5);
  assert.equal(pw.groups.find((g) => g.id === "hellier-season-2")?.links.length, 10);
});

test("a card leads to the source's own page when it has one, otherwise to its place on the primary page", () => {
  for (const s of PRIMARY_SOURCES) {
    assert.equal(primaryHref(s), s.page ?? `/sources/primary#${s.id}`);
    if (s.page) assert.match(s.page, /^\/sources\//);
  }
});

test("the wording never states psi as proven or dismisses it", () => {
  for (const s of PRIMARY_SOURCES) {
    const words = [s.about, s.why ?? "", s.caution ?? "", ...(s.groups ?? []).flatMap((g) => [g.intro ?? "", ...g.links.map((l) => l.note ?? "")])];
    for (const w of words) assert.doesNotMatch(w, /\b(proves?|proven|scientifically shown|superstition|debunk\w*|pseudoscien\w*)\b/i, w.slice(0, 60));
  }
});

test("the primary sources page checks sign-in and reads the shared list", () => {
  const page = readFileSync(new URL("../app/sources/primary/page.tsx", import.meta.url), "utf8");
  assert.match(page, /if \(!session\.userId\) redirect\("\/login"\)/);
  assert.match(page, /PRIMARY_SOURCES\.map/);
});

test("the secondary list and the things to check out are kept apart from the primaries", () => {
  assert.deepEqual(SECONDARY_SOURCES.map((s) => s.id), ["toy", "penrose"]);
  for (const s of SECONDARY_SOURCES) assert.ok(!PRIMARY_SOURCES.includes(s), s.id);
  assert.ok(CHECK_OUT.length > 0);
  for (const l of CHECK_OUT) assert.match(l.url, /^https:\/\//, l.label);
  assert.ok(CHECK_OUT.some((l) => /Beacon/.test(l.label)));
});
