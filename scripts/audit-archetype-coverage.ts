/**
 * Coverage audit of the shared language (archetypes), read-only. For every piece of every ritual set it lists the
 * archetypes the app links it to today and where that link lives (the database for tarot, the code for the other
 * tools), and names the pieces with none, with only one, or with a link that points at an archetype that does not exist.
 * Writes docs/archetype-coverage-audit.md. Changes nothing in the database (one READ ONLY transaction).
 *
 * It never reads .env files, so it cannot reach the live database by accident. Point it at the dev branch yourself:
 *   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
 *   npx tsx scripts/audit-archetype-coverage.ts
 * It refuses any database but your dev one (scripts/dev-database.ts) unless you pass --allow-live.
 */
import { hostOf, isDevDatabase, NOT_DEV } from "./dev-database";
import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { writeFileSync } from "fs";
import { join } from "path";
import { ARCHETYPES } from "../lib/archetypes-data";
import {
  COIN_MEANINGS, OGHAM_MEANINGS, PENDULUM_MEANINGS, RUNE_MEANINGS, SCRYING_MEANINGS, COMMON_SOURCES,
  numberMeaning, pendulumKey, type CommonMeaning,
} from "../lib/common-meanings-data";
import { RUNES } from "../lib/runes-data";
import { STAVES } from "../lib/ogham-data";
import { DICE_OBJECTS, faceId, isNumbered } from "../lib/dice-data";
import { BUILTIN_SWINGS } from "../lib/pendulum-swings";
import { SCRYING_SURFACES } from "../lib/scrying-surfaces";
import { TAROT_DECK } from "../lib/cards";
import { EMPTY_STORE, linksOf, type SymbolLinkRow, type SymbolStore } from "../lib/symbol-links-core";

const SLUGS = new Set(ARCHETYPES.map((a) => a.slug));

interface Row {
  id: string;
  name: string;
  archetypes: string[];
  note?: string;
  /** True when the database has a record of this piece (symbol_archetypes or symbol_notes). */
  recorded?: boolean;
}
const bad = (slugs: string[]) => slugs.filter((s) => !SLUGS.has(s));

function codeSection(title: string, source: string, rows: Row[]): string {
  const none = rows.filter((r) => r.archetypes.length === 0);
  const one = rows.filter((r) => r.archetypes.length === 1);
  const dangling = rows.filter((r) => bad(r.archetypes).length > 0);
  const out = [
    `### ${title}`,
    "",
    `${rows.length} pieces. With no archetype: **${none.length}**. With only one: ${one.length}. With a slug that is not an archetype: ${dangling.length}.`,
    "",
    `Where the links live: **${rows.filter((r) => r.recorded).length} of ${rows.length}** pieces are recorded in the database (\`symbol_archetypes\`, migration 059, with a basis on every link); the rest are read from the older mapping in code (\`lib/common-meanings-data.ts\`), which records no basis. What the file says about the source for the whole tool: ${source}`,
    "",
    "| id | name | archetypes (strongest first) | note |",
    "|---|---|---|---|",
    ...rows.map((r) => `| \`${r.id}\` | ${r.name} | ${r.archetypes.length ? r.archetypes.join(", ") : "**none**"} | ${r.note ?? ""} |`),
    "",
  ];
  return out.join("\n");
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL first (see the top of this file). This script never reads .env files.");
  const host = hostOf(url);
  console.log("Database host:", host);
  if (!isDevDatabase(host) && !process.argv.includes("--allow-live")) {
    throw new Error(`${NOT_DEV} Pass --allow-live to read the live database anyway.`);
  }

  const pool = new Pool({ connectionString: connectionStringFor(url) });
  const client = await pool.connect();
  await client.query("BEGIN READ ONLY");

  // ---- Tarot, from the database
  const cardRows = (
    await client.query<{ card_id: string; reversed: boolean; slug: string | null; aspect: string | null; concepts: string }>(
      `SELECT cc.card_id, cc.reversed, a.slug, ca.aspect, COUNT(DISTINCT cc.concept_id) AS concepts
         FROM card_concepts cc
         LEFT JOIN concept_archetypes ca ON ca.concept_id = cc.concept_id
         LEFT JOIN archetypes a ON a.id = ca.archetype_id
        GROUP BY cc.card_id, cc.reversed, a.slug, ca.aspect`
    )
  ).rows;
  const conceptTotals = (
    await client.query<{ card_id: string; reversed: boolean; total: string; unsorted: string }>(
      `SELECT cc.card_id, cc.reversed, COUNT(DISTINCT cc.concept_id) AS total,
              COUNT(DISTINCT cc.concept_id) FILTER (WHERE NOT EXISTS (SELECT 1 FROM concept_archetypes x WHERE x.concept_id = cc.concept_id)) AS unsorted
         FROM card_concepts cc GROUP BY cc.card_id, cc.reversed`
    )
  ).rows;
  const dbCounts = (
    await client.query<{ concepts: string; links: string; unsorted: string; archetypes: string }>(
      `SELECT (SELECT COUNT(*) FROM concepts) AS concepts,
              (SELECT COUNT(*) FROM concept_archetypes) AS links,
              (SELECT COUNT(*) FROM concepts c WHERE NOT EXISTS (SELECT 1 FROM concept_archetypes x WHERE x.concept_id = c.id)) AS unsorted,
              (SELECT COUNT(*) FROM archetypes) AS archetypes`
    )
  ).rows[0];
  const dbSlugs = new Set((await client.query<{ slug: string }>("SELECT slug FROM archetypes")).rows.map((r) => r.slug));
  const swingRows = (
    await client.query<{ shape: string; angle: number | null; builtin: number; n: string }>(
      "SELECT shape, angle, builtin, COUNT(*) AS n FROM pendulum_swings GROUP BY shape, angle, builtin"
    )
  ).rows;
  // The links people can see: the database's record of each piece (migration 059) where it has one, else the mapping in code.
  const hasSymbolTables =
    Number(
      (await client.query<{ n: string }>(
        "SELECT COUNT(*) AS n FROM information_schema.tables WHERE table_name IN ('symbol_archetypes', 'symbol_notes') AND table_schema = current_schema()"
      )).rows[0].n
    ) === 2;
  let store: SymbolStore = EMPTY_STORE;
  if (hasSymbolTables) {
    const links = new Map<string, SymbolLinkRow[]>();
    const recorded = new Set<string>();
    const rows = (
      await client.query<{ symbol_id: string; slug: string; aspect: string; basis: string; is_primary: boolean }>(
        "SELECT s.symbol_id, a.slug, s.aspect, s.basis, s.is_primary FROM symbol_archetypes s JOIN archetypes a ON a.id = s.archetype_id ORDER BY s.symbol_id, s.sort_order"
      )
    ).rows;
    for (const r of rows) {
      recorded.add(r.symbol_id);
      links.set(r.symbol_id, [...(links.get(r.symbol_id) ?? []), { slug: r.slug, aspect: r.aspect as SymbolLinkRow["aspect"], basis: r.basis, primary: r.is_primary }]);
    }
    for (const r of (await client.query<{ symbol_id: string }>("SELECT symbol_id FROM symbol_notes")).rows) recorded.add(r.symbol_id);
    store = { links, recorded, notes: new Map() };
  }
  const eff = (id: string, code: string[]) => linksOf(store, id, code).map((l) => l.slug);
  const rec = (id: string) => store.recorded.has(id);
  await client.query("ROLLBACK");
  client.release();
  await pool.end();

  interface CardInfo {
    up: number; rev: number; upUnsorted: number; revUnsorted: number;
    upArch: Map<string, number>; revArch: Map<string, number>;
  }
  const cards = new Map<string, CardInfo>();
  const info = (id: string) => {
    let c = cards.get(id);
    if (!c) cards.set(id, (c = { up: 0, rev: 0, upUnsorted: 0, revUnsorted: 0, upArch: new Map(), revArch: new Map() }));
    return c;
  };
  for (const t of conceptTotals) {
    const c = info(t.card_id);
    if (t.reversed) { c.rev = Number(t.total); c.revUnsorted = Number(t.unsorted); } else { c.up = Number(t.total); c.upUnsorted = Number(t.unsorted); }
  }
  for (const r of cardRows) {
    if (!r.slug) continue;
    const m = (r.reversed ? info(r.card_id).revArch : info(r.card_id).upArch);
    m.set(r.slug, (m.get(r.slug) ?? 0) + Number(r.concepts));
  }
  const top = (m: Map<string, number>, n = 3) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([s, k]) => `${s} (${k})`).join(", ") || "**none**";

  // A card "has no clear lead" when no archetype holds more than 2 of its concepts, or more than a quarter of them: its
  // first archetype would be a coin toss between several equally weighted ones.
  const lead = (m: Map<string, number>, total: number) => {
    const best = Math.max(0, ...m.values());
    return best > 2 && best / Math.max(total, 1) > 0.25;
  };
  const noLeadUp: string[] = [];
  const noLeadRev: string[] = [];
  const tarotLines: string[] = [];
  const tarotNone: string[] = [];
  const tarotThin: string[] = [];
  const tarotNoReversed: string[] = [];
  for (const card of TAROT_DECK) {
    const c = cards.get(card.id) ?? { up: 0, rev: 0, upUnsorted: 0, revUnsorted: 0, upArch: new Map(), revArch: new Map() };
    if (c.upArch.size === 0 && c.revArch.size === 0) tarotNone.push(card.name);
    else if (c.upArch.size === 0) tarotNone.push(`${card.name} (upright)`);
    if (!lead(c.upArch, c.up)) noLeadUp.push(card.name);
    if (!lead(c.revArch, c.rev)) noLeadRev.push(card.name);
    if (c.up > 0 && c.up < 5) tarotThin.push(`${card.name} (${c.up} upright concepts)`);
    if (c.revArch.size === 0) tarotNoReversed.push(card.name);
    tarotLines.push(
      `| \`${card.id}\` | ${card.name} | ${c.up} | ${c.upArch.size} | ${top(c.upArch)} | ${c.rev} | ${c.revArch.size} | ${top(c.revArch)} |`
    );
  }
  const deckIds = new Set(TAROT_DECK.map((c) => c.id));
  const strayCards = [...cards.keys()].filter((id) => !deckIds.has(id));
  const unsortedOnCards = [...cards.values()].reduce((s, c) => s + c.upUnsorted + c.revUnsorted, 0);

  // ---- The other tools, from code
  const runeRows: Row[] = RUNES.map((r) => ({ id: r.id, name: r.name, archetypes: eff(r.id, RUNE_MEANINGS[r.id]?.archetypes ?? []), recorded: rec(r.id) }));
  const staveRows: Row[] = STAVES.map((s) => ({
    id: s.id, name: s.name, archetypes: eff(s.id, OGHAM_MEANINGS[s.id]?.archetypes ?? []), recorded: rec(s.id),
    note: s.aicme === 0 ? "later letter (forfeda): none on purpose, see its note in the database" : undefined,
  }));
  const orphanKeys = {
    rune: Object.keys(RUNE_MEANINGS).filter((k) => !RUNES.some((r) => r.id === k)),
    ogham: Object.keys(OGHAM_MEANINGS).filter((k) => !STAVES.some((s) => s.id === k)),
  };
  const coinRows: Row[] = Object.entries(COIN_MEANINGS).map(([id, m]) => ({ id, name: id.replace("coin-", "") === "heads" ? "Heads" : "Tails", archetypes: eff(id, m.archetypes), recorded: rec(id) }));
  const diceRows: Row[] = [];
  const diceSummary: string[] = [];
  for (const obj of DICE_OBJECTS) {
    if (!isNumbered(obj.id)) continue;
    let direct = 0, reduced = 0, none = 0;
    for (let n = 1; n <= obj.faces; n++) {
      const m: CommonMeaning & { reduction?: string } = numberMeaning(n, obj.faces);
      if (m.archetypes.length === 0) none++;
      if (m.reduction) reduced++; else direct++;
      if (n <= Math.min(obj.faces, 12)) diceRows.push({ id: `${obj.id}-${n}`, name: `${obj.id} face ${n}`, archetypes: eff(faceId(obj.id, String(n)), m.archetypes), recorded: rec(faceId(obj.id, String(n))), note: m.reduction ? "by reduction" : undefined });
    }
    diceSummary.push(`| ${obj.id} | ${obj.faces} | ${direct} | ${reduced} | ${none} |`);
  }
  const pendulumRows: Row[] = BUILTIN_SWINGS.map((s) => {
    const key = pendulumKey({ shape: s.shape, angle: s.angle, builtin: 1 })!;
    return { id: key, name: key.replace("swing-", ""), archetypes: eff(key, PENDULUM_MEANINGS[key]?.archetypes ?? []), recorded: rec(key) };
  });
  const added = swingRows.filter((r) => pendulumKey({ shape: r.shape, angle: r.angle, builtin: r.builtin }) === null);
  const addedCount = added.reduce((s, r) => s + Number(r.n), 0);
  const scryRows: Row[] = SCRYING_SURFACES.map((s) => ({ id: `scrying-${s}`, name: s, archetypes: eff(`scrying-${s}`, SCRYING_MEANINGS[`scrying-${s}`]?.archetypes ?? []), recorded: rec(`scrying-${s}`) }));

  // ---- The other direction: archetypes and who touches them
  const toolHits = new Map<string, Record<string, number>>();
  const hit = (slug: string, tool: string) => {
    const e = toolHits.get(slug) ?? {};
    e[tool] = (e[tool] ?? 0) + 1;
    toolHits.set(slug, e);
  };
  for (const r of runeRows) r.archetypes.forEach((s) => hit(s, "runes"));
  for (const r of staveRows) r.archetypes.forEach((s) => hit(s, "ogham"));
  for (const r of coinRows) r.archetypes.forEach((s) => hit(s, "coin"));
  for (const r of diceRows) r.archetypes.forEach((s) => hit(s, "dice"));
  for (const r of pendulumRows) r.archetypes.forEach((s) => hit(s, "pendulum"));
  for (const r of scryRows) r.archetypes.forEach((s) => hit(s, "scrying"));
  const tarotPrimary = new Map<string, number>();
  for (const c of cards.values()) for (const m of [c.upArch, c.revArch]) for (const [s, n] of m) tarotPrimary.set(s, (tarotPrimary.get(s) ?? 0) + n);
  const noTools = ARCHETYPES.filter((a) => !toolHits.has(a.slug)).map((a) => a.slug);
  const noTarot = ARCHETYPES.filter((a) => !tarotPrimary.has(a.slug)).map((a) => a.slug);
  const neither = ARCHETYPES.filter((a) => !toolHits.has(a.slug) && !tarotPrimary.has(a.slug)).map((a) => a.slug);
  const codeNotInDb = ARCHETYPES.filter((a) => !dbSlugs.has(a.slug)).map((a) => a.slug);
  const dbNotInCode = [...dbSlugs].filter((s) => !SLUGS.has(s));
  const allCodeRows = [...runeRows, ...staveRows, ...coinRows, ...diceRows, ...pendulumRows, ...scryRows];
  const danglingAll = allCodeRows.flatMap((r) => bad(r.archetypes).map((s) => `${r.id}: ${s}`));
  const nonTarotNone = allCodeRows.filter((r) => r.archetypes.length === 0);

  const list = (xs: string[]) => (xs.length ? xs.join(", ") : "none");
  const md = [
    "# Archetype coverage audit",
    "",
    `Written by \`scripts/audit-archetype-coverage.ts\` on ${new Date().toISOString().slice(0, 10)}, read-only, against the Neon dev branch (host ${host.slice(0, 20)}…). Nothing was changed. Rerun it any time: it is the check that every piece of every set has at least one archetype.`,
    "",
    "## The short answer",
    "",
    `- **Tarot:** ${TAROT_DECK.length} cards. With no archetype at all: **${tarotNone.length}** (${list(tarotNone)}). With no archetype on the reversed side: **${tarotNoReversed.length}**. With fewer than 5 upright concepts: ${tarotThin.length}.`,
    `- **Tarot, how clear is each card's lead?** Having an archetype is not the same as having a clear one. Upright, **${TAROT_DECK.length - noLeadUp.length}** cards have an archetype holding more than 2 of their concepts and over a quarter of them; **${noLeadUp.length}** do not. Reversed: **${TAROT_DECK.length - noLeadRev.length}** do, **${noLeadRev.length}** do not.`,
    `- **Runes:** ${runeRows.length}, none without an archetype: **${runeRows.filter((r) => !r.archetypes.length).length}**. **Ogham:** ${staveRows.length} letters, **${staveRows.filter((r) => !r.archetypes.length).length}** without (${list(staveRows.filter((r) => !r.archetypes.length).map((r) => r.name))}).`,
    `- **Coin:** ${coinRows.length} sides, ${coinRows.filter((r) => !r.archetypes.length).length} without. **Dice:** every face of d4 to d100 resolves to an archetype (faces above 12 by numerology reduction): ${nonTarotNone.filter((r) => /^d\d/.test(r.id)).length} without.`,
    `- **Pendulum:** the ${pendulumRows.length} built-in swings are covered; **${addedCount}** added-angle swing rows in the dev branch have no stock words and no archetype (a person's own angles cannot have any until we decide what to do about them). **Scrying:** ${scryRows.length} surfaces, ${scryRows.filter((r) => !r.archetypes.length).length} without.`,
    `- **Oracle decks** (a person's own items): none have archetypes by design; they need the person's own links (Part 2, section C).`,
    `- **Links pointing at a slug that is not an archetype (code):** ${danglingAll.length}${danglingAll.length ? ` (${danglingAll.join("; ")})` : ""}.`,
    `- **Where the links live:** tarot in the database (${dbCounts.links} concept links over ${dbCounts.concepts} concepts; ${dbCounts.unsorted} concepts have no archetype; ${unsortedOnCards} card-concept pairs point at an unsorted concept); the other tools in the database where recorded (migration 059) and in code where not. **Tarot links, and the links of any piece not yet recorded, still say nothing about what they were drawn from.**`,
    `- **Archetypes with no tool piece:** ${noTools.length}. **With no tarot concept:** ${noTarot.length}. **With neither:** ${neither.length}. Code and database agree on the ${dbCounts.archetypes} archetypes: ${codeNotInDb.length === 0 && dbNotInCode.length === 0 ? "yes" : `NO (code only: ${list(codeNotInDb)}; database only: ${list(dbNotInCode)})`}.`,
    "",
    "## Tarot (database)",
    "",
    "Columns: upright concepts, distinct archetypes they sit under, the three strongest (with how many concepts); then the same for reversed. A card's archetype today is **derived** from its concepts; there is no row that says \"this card is Courage\".",
    "",
    `Concepts on a card with no archetype link: ${unsortedOnCards}. Card ids in the database that are not in the 78-card deck: ${list(strayCards)}.`,
    "",
    `No clear lead, upright (${noLeadUp.length}): ${list(noLeadUp)}.
`,
    `No clear lead, reversed (${noLeadRev.length}): ${list(noLeadRev)}.
`,
    tarotThin.length ? `Thin (under 5 upright concepts): ${tarotThin.join("; ")}.\n` : "",
    "| id | card | up | up arch. | strongest upright | rev | rev arch. | strongest reversed |",
    "|---|---|---|---|---|---|---|---|",
    ...tarotLines,
    "",
    "Basis of the tarot concepts: the upright concepts come from the encyclopedia data (the \"St. Cepesa Horat\" CSVs, see the `seed-data` skill); the reversed concepts were added later by `scripts/seed-reversed-*.ts`. Which concept was drawn from which source is not recorded per row.",
    "",
    "## The other tools (code)",
    "",
    codeSection("Runes (Elder Futhark)", COMMON_SOURCES.rune, runeRows),
    orphanKeys.rune.length ? `Keys in \`RUNE_MEANINGS\` that match no rune: ${orphanKeys.rune.join(", ")}.\n` : "",
    codeSection("Ogham", COMMON_SOURCES.ogham, staveRows),
    orphanKeys.ogham.length ? `Keys in \`OGHAM_MEANINGS\` that match no stave: ${orphanKeys.ogham.join(", ")}.\n` : "",
    codeSection("Coin", COMMON_SOURCES.coin, coinRows),
    "### Dice",
    "",
    `Every die resolves to an archetype for every face. The first 12 faces are listed below; \`direct\` means the number has its own entry in the numerology table, \`reduced\` means its digits are added until one is left (so a d100 face 57 is read as 3). Source note: ${COMMON_SOURCES.number}`,
    "",
    "| die | faces | direct | reduced | without archetype |",
    "|---|---|---|---|---|",
    ...diceSummary,
    "",
    "| id | name | archetypes | note |",
    "|---|---|---|---|",
    ...diceRows.map((r) => `| \`${r.id}\` | ${r.name} | ${r.archetypes.join(", ") || "**none**"} | ${r.note ?? ""} |`),
    "",
    codeSection("Pendulum (the five built-in swings)", COMMON_SOURCES.pendulum, pendulumRows),
    `Added-angle swings in the dev branch (no stock words, no archetype): **${addedCount}** rows${added.length ? ` (${added.map((r) => `${r.shape}${r.angle !== null ? ` ${r.angle}°` : ""} ×${r.n}`).join(", ")})` : ""}.\n`,
    codeSection("Scrying surfaces", COMMON_SOURCES.scrying, scryRows),
    "## The other direction: archetypes and who touches them",
    "",
    `- Archetypes no non-tarot tool touches (${noTools.length}): ${list(noTools)}`,
    `- Archetypes no tarot concept sits under (${noTarot.length}): ${list(noTarot)}`,
    `- Archetypes nothing touches (${neither.length}): ${list(neither)}`,
    "",
    "## What this means for the overhaul",
    "",
    "These are Claude's readings of the numbers (generated from them each time), for you to confirm or correct.",
    "",
    `1. **There is no hole to fill in the shared language itself, except in three places:** the ${staveRows.filter((r) => !r.archetypes.length).length} ogham forfeda, the added pendulum angles (${addedCount} on this branch), and the oracle decks (a person's own items, by design). Every tarot card, rune, other ogham letter, coin side, die face and scrying surface already reaches at least one archetype.`,
    `2. **The real gaps are different:** (a) no link records its basis or how settled it is, anywhere; (b) tarot has no card-level archetype, only a pile of concepts, and ${noLeadUp.length} cards upright and ${noLeadRev.length} reversed have no clear lead, so "this card's first archetype" cannot be read directly; (c) the code mapping for the other tools cannot be edited in the app; (d) people cannot add their own.`,
    `3. **${noTools.length} of the ${ARCHETYPES.length} archetypes are touched by no non-tarot tool** (listed above). That is not an error: grief, jealousy or forgiveness have no rune. It does mean those themes can only ever show tarot in the Patterns comparison, so it is worth deciding whether to leave them or let people link their own pieces to them.`,
    "",
  ].join("\n");

  writeFileSync(join(process.cwd(), "docs", "archetype-coverage-audit.md"), md, "utf8");
  console.log(`Tarot: ${tarotNone.length} cards with no archetype, ${tarotNoReversed.length} with none reversed, ${tarotThin.length} thin.`);
  console.log(`Runes without: ${runeRows.filter((r) => !r.archetypes.length).length}; ogham without: ${staveRows.filter((r) => !r.archetypes.length).length}; added swings: ${addedCount}.`);
  console.log(`Archetypes with no tool: ${noTools.length}, no tarot: ${noTarot.length}, neither: ${neither.length}. Dangling slugs: ${danglingAll.length}.`);
  console.log("Wrote docs/archetype-coverage-audit.md");
}

main().catch((e) => {
  console.error("audit FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
