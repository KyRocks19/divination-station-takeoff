/**
 * Sets the hand-written tarot mapping (data/symbol-archetypes-tarot.txt) beside where each card's encyclopedia concepts sit, so the
 * mapping can be reviewed card by card, and writes docs/tarot-archetype-draft-review.md. Read-only (one READ ONLY transaction);
 * it reads no secret from .env files (only the dev database's host name) and refuses any host but the dev branch unless told otherwise, like the audit script.
 *   export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
 *   npx tsx scripts/review-tarot-archetypes.ts
 */
import { hostOf, isDevDatabase, NOT_DEV } from "./dev-database";
import { connectionStringFor } from "../lib/db-ssl";
import { Pool } from "pg";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { TAROT_DECK } from "../lib/cards";
import { ARCHETYPES } from "../lib/archetypes-data";
import { parseSymbolArchetypeFile } from "../lib/symbol-archetype-map";

const name = (slug: string) => ARCHETYPES.find((a) => a.slug === slug)?.name ?? slug;

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Set DATABASE_URL first (see the top of this file). This script never reads .env files.");
  const host = hostOf(url);
  if (!isDevDatabase(host) && !process.argv.includes("--allow-live")) throw new Error(`${NOT_DEV} Pass --allow-live to read another database.`);

  const pool = new Pool({ connectionString: connectionStringFor(url) });
  const client = await pool.connect();
  await client.query("BEGIN READ ONLY");
  const rows = (
    await client.query<{ card_id: string; reversed: boolean; slug: string; n: string }>(
      `SELECT cc.card_id, cc.reversed, a.slug, COUNT(DISTINCT cc.concept_id) AS n
         FROM card_concepts cc JOIN concept_archetypes ca ON ca.concept_id = cc.concept_id JOIN archetypes a ON a.id = ca.archetype_id
        GROUP BY cc.card_id, cc.reversed, a.slug`
    )
  ).rows;
  await client.query("ROLLBACK");
  client.release();
  await pool.end();

  const map = parseSymbolArchetypeFile(readFileSync(join(process.cwd(), "data", "symbol-archetypes-tarot.txt"), "utf8"));
  const byCard = new Map(map.entries.map((e) => [e.id, e]));
  const top = (id: string, rev: boolean, n: number) =>
    rows.filter((r) => r.card_id === id && r.reversed === rev).sort((a, b) => Number(b.n) - Number(a.n) || a.slug.localeCompare(b.slug)).slice(0, n);
  const fmt = (xs: { slug: string; n: string }[]) => xs.map((x) => `${x.slug} (${x.n})`).join(", ") || "none";

  let leadBoth = 0, leadOne = 0, overlap = 0, none = 0;
  const lines: string[] = [];
  const attention: string[] = [];
  const bases: Record<string, number> = {};
  const primaryBases: Record<string, number> = {};
  for (const card of TAROT_DECK) {
    const e = byCard.get(card.id)!;
    for (const l of e.links) bases[l.basis] = (bases[l.basis] ?? 0) + 1;
    primaryBases[e.links[0].basis] = (primaryBases[e.links[0].basis] ?? 0) + 1;
    const up3 = top(card.id, false, 3).map((x) => x.slug);
    const rv3 = top(card.id, true, 3).map((x) => x.slug);
    const up6 = top(card.id, false, 6).map((x) => x.slug);
    const rv6 = top(card.id, true, 6).map((x) => x.slug);
    const mine = e.links.map((l) => l.slug);
    const primary = mine[0];
    let verdict: string;
    if (up3.includes(primary) && rv3.includes(primary)) { verdict = "agrees both sides"; leadBoth++; }
    else if (up3.includes(primary) || rv3.includes(primary)) { verdict = "agrees one side"; leadOne++; }
    else if (mine.some((s) => [...up6, ...rv6].includes(s))) { verdict = "a link is among its concepts"; overlap++; }
    else { verdict = "no overlap"; none++; attention.push(`${card.name} (${mine.join(", ")})`); }
    lines.push(
      `| \`${card.id}\` | ${card.name} | ${e.links.map((l) => `${l.slug} · ${l.basis}`).join("<br>")} | ${fmt(top(card.id, false, 3))} | ${fmt(top(card.id, true, 3))} | ${verdict} |`
    );
  }

  const md = [
    "# Tarot card-level archetypes: a draft to review",
    "",
    `Written by \`scripts/review-tarot-archetypes.ts\` on ${new Date().toISOString().slice(0, 10)}, read-only, against the Neon dev branch. The mapping itself is \`data/symbol-archetypes-tarot.txt\`: 78 cards, one to three archetypes each, the first being the card's primary. **Nothing here is in the database yet.** It is a draft for you to read, change and approve before anything is seeded.`,
    "",
    "## How to read this",
    "",
    "Each card's links were chosen from what the card itself says: its Pixie-Smith keywords and text (`lib/cards.ts`), its number, its suit, or its name. The columns on the right are only a **check**: where the card's encyclopedia concepts (2,059 shared concepts, sorted by hand into the 84 archetypes) sit, upright and reversed, with the number of concepts in brackets. The two come from different places, so they should often agree and sometimes not. Where they disagree, neither is automatically right.",
    "",
    `- **Primary link is among the card's top three concept archetypes, upright and reversed:** ${leadBoth} cards. **On one side only:** ${leadOne}.`,
    `- **No primary match, but another link of the card is among its top six concept archetypes:** ${overlap}.`,
    `- **No overlap at all:** ${none}${none ? ` (${attention.join("; ")}). These are the first to look at.` : "."}`,
    `- **Links by basis:** ${Object.entries(bases).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}. **First links by basis:** ${Object.entries(primaryBases).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", ")}.`,
    "",
    "## Honest limits",
    "",
    "- The Pixie-Smith keywords in this app follow modern reading practice more than A. E. Waite's 1910 book. Authors differ on almost every card, and a card's reversed meaning is mostly modern.",
    "- Tarot numerology (Aces begin, Fives test) and the suit correspondences are modern practice too, though old in the Golden Dawn's version.",
    "- There is no source card yet for Waite's *Pictorial Key to the Tarot*. Until there is, none of these bases lists a source.",
    "- Every link is neutral: it says the card reaches the archetype, upright or reversed, not which side. The Patterns page still counts tarot through the concepts (so sides stay exact); these links are for naming a card's archetype directly and for the card's own page.",
    "",
    "## Card by card",
    "",
    "| id | card | links (primary first) · basis | concepts, upright (top 3) | concepts, reversed (top 3) | check |",
    "|---|---|---|---|---|---|",
    ...lines,
    "",
    "## What happens when you approve",
    "",
    "Say which cards to change. Then the seed script would be extended to read this file (the same safe defaults as for runes and ogham: dev branch only unless told otherwise, only cards with no rows yet, the database the record afterwards), and the archetype pages and each card's own page would show these links with their basis.",
    "",
  ].join("\n");
  writeFileSync(join(process.cwd(), "docs", "tarot-archetype-draft-review.md"), md, "utf8");
  console.log(`agree both ${leadBoth}, one side ${leadOne}, other link overlaps ${overlap}, no overlap ${none}`);
  if (none) console.log("No overlap:", attention.join("; "));
}

main().catch((e) => {
  console.error("review FAILED:", e instanceof Error ? e.message : e);
  process.exit(1);
});
