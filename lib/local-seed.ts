import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ARCHETYPES } from "./archetypes-data";
import { checkSymbolMap, parseSymbolArchetypeFile } from "./symbol-archetype-map";
import { symbolSets } from "./symbol-seed-sets";
import { SOURCES } from "./sources";
import { chunks, parseBundle } from "./local-seed-core";
import { applyConceptWording } from "./concept-wording";

// Seeds the shared reference data into a fresh local folder (open item ED9): the archetypes and the links from the tools' pieces to them (both live
// in the repository), and, if the owner's reference bundle is there, the encyclopedia's concepts. Run by lib/local-db.ts after the migrations on every
// start. It only fills gaps: an archetype's words come from the code (as scripts/seed-archetypes.ts does), but a piece that already has links, or a
// folder that already has concepts, is left exactly as it is, so nothing a person or an admin changed later is overwritten. Server code only.

export interface SeedDb {
  exec(sql: string): Promise<unknown>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}

export interface SeedResult {
  archetypes: number;
  pieces: number;
  concepts: number;
  /** "found" when a bundle was read, "none" when there was none, "unusable" when there was one that did not hold up (said in `problems`). */
  bundle: "found" | "none" | "unusable";
  problems: string[];
}

/** Where the bundle is looked for: DS_REFERENCE_BUNDLE, else data/reference-bundle.json in the app's folder (not in the repository: .gitignore). */
export function bundlePath(): string {
  return process.env.DS_REFERENCE_BUNDLE?.trim() || join(/* turbopackIgnore: true */ process.cwd(), "data", "reference-bundle.json");
}

export async function seedSharedData(db: SeedDb, opts: { root?: string; bundleFile?: string } = {}): Promise<SeedResult> {
  const root = opts.root ?? process.cwd();
  const result: SeedResult = { archetypes: 0, pieces: 0, concepts: 0, bundle: "none", problems: [] };
  const known = new Set(ARCHETYPES.map((a) => a.slug));

  // Read and check every file before the first write.
  const sourceIds = new Set(SOURCES.map((s) => s.id));
  const sets = symbolSets().map((s) => {
    const map = parseSymbolArchetypeFile(readFileSync(/* turbopackIgnore: true */ join(/* turbopackIgnore: true */ root, s.file), "utf8"));
    const problems = checkSymbolMap(map, s.ids, known, sourceIds);
    if (problems.length) throw new Error(`${s.file} has problems: ${problems.join("; ")}`);
    return map;
  });
  const file = opts.bundleFile ?? bundlePath();
  const parsed = existsSync(/* turbopackIgnore: true */ file) ? parseBundle(readFileSync(/* turbopackIgnore: true */ file, "utf8"), known) : null;

  await db.exec("BEGIN");
  try {
    // 1. The archetypes: the code is the source of their words, so they are written every time.
    await db.query(
      `INSERT INTO archetypes (slug, name, realm, summary, light, shadow, sort_order)
       SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[], $5::text[], $6::text[], $7::int[])
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name, realm = EXCLUDED.realm, summary = EXCLUDED.summary, light = EXCLUDED.light, shadow = EXCLUDED.shadow, sort_order = EXCLUDED.sort_order`,
      [ARCHETYPES.map((a) => a.slug), ARCHETYPES.map((a) => a.name), ARCHETYPES.map((a) => a.realm), ARCHETYPES.map((a) => a.summary), ARCHETYPES.map((a) => a.light), ARCHETYPES.map((a) => a.shadow), ARCHETYPES.map((_, i) => i)]
    );
    result.archetypes = ARCHETYPES.length;
    const idOf = new Map((await db.query<{ id: number; slug: string }>("SELECT id, slug FROM archetypes")).rows.map((r) => [r.slug, r.id]));

    // 2. The tools' pieces: only a piece with no links and no note yet is written.
    const have = new Set([
      ...(await db.query<{ symbol_id: string }>("SELECT symbol_id FROM symbol_archetypes")).rows.map((r) => r.symbol_id),
      ...(await db.query<{ symbol_id: string }>("SELECT symbol_id FROM symbol_notes")).rows.map((r) => r.symbol_id),
    ]);
    const link = { id: [] as string[], arch: [] as number[], aspect: [] as string[], primary: [] as boolean[], basis: [] as string[], order: [] as number[] };
    const note = { id: [] as string[], text: [] as string[] };
    for (const map of sets) {
      for (const e of map.entries) {
        if (have.has(e.id)) continue;
        result.pieces++;
        for (const [i, l] of e.links.entries()) {
          link.id.push(e.id); link.arch.push(idOf.get(l.slug)!); link.aspect.push(l.aspect); link.primary.push(l.primary); link.basis.push(l.basis); link.order.push(i);
        }
        if (e.note) { note.id.push(e.id); note.text.push(e.note); }
      }
    }
    if (link.id.length) {
      await db.query(
        `INSERT INTO symbol_archetypes (symbol_id, archetype_id, aspect, is_primary, basis, sort_order)
         SELECT * FROM unnest($1::text[], $2::int[], $3::text[], $4::boolean[], $5::text[], $6::int[])`,
        [link.id, link.arch, link.aspect, link.primary, link.basis, link.order]
      );
    }
    if (note.id.length) await db.query("INSERT INTO symbol_notes (symbol_id, note) SELECT * FROM unnest($1::text[], $2::text[])", [note.id, note.text]);

    // 3. The concepts, from the owner's bundle, only into a folder that has none.
    if (parsed) {
      if (!parsed.bundle) {
        result.bundle = "unusable";
        result.problems = parsed.problems.slice(0, 10);
      } else {
        result.bundle = "found";
        const n = Number((await db.query<{ n: string }>("SELECT COUNT(*) AS n FROM concepts")).rows[0].n);
        if (n === 0) {
          const b = parsed.bundle;
          for (const part of chunks(b.concepts, 1000)) {
            await db.query("INSERT INTO concepts (name, display_name, description) SELECT * FROM unnest($1::text[], $2::text[], $3::text[]) ON CONFLICT (name) DO NOTHING",
              [part.map((c) => c.name), part.map((c) => c.display_name), part.map((c) => c.description)]);
          }
          for (const part of chunks(b.card_concepts, 5000)) {
            await db.query(
              `INSERT INTO card_concepts (card_id, concept_id, reversed)
               SELECT x.card, c.id, x.rev FROM unnest($1::text[], $2::text[], $3::boolean[]) AS x(card, concept, rev) JOIN concepts c ON c.name = x.concept
               ON CONFLICT DO NOTHING`,
              [part.map((e) => e.card_id), part.map((e) => e.concept), part.map((e) => e.reversed)]
            );
          }
          for (const part of chunks(b.concept_archetypes, 5000)) {
            await db.query(
              `INSERT INTO concept_archetypes (concept_id, archetype_id, aspect, is_primary)
               SELECT c.id, a.id, x.aspect, x.prim FROM unnest($1::text[], $2::text[], $3::text[], $4::boolean[]) AS x(concept, slug, aspect, prim)
               JOIN concepts c ON c.name = x.concept JOIN archetypes a ON a.slug = x.slug
               ON CONFLICT DO NOTHING`,
              [part.map((e) => e.concept), part.map((e) => e.slug), part.map((e) => e.aspect), part.map((e) => e.primary)]
            );
          }
          result.concepts = b.concepts.length;
          // The bundle may have been made before the wording changes of ED21 (reworded names, sensitive and hidden ones), so apply them here too.
          await applyConceptWording((sql, params) => db.query<any>(sql, params), true);
        }
      }
    }
    await db.exec("COMMIT");
  } catch (err) {
    await db.exec("ROLLBACK").catch(() => {});
    throw err;
  }
  return result;
}
