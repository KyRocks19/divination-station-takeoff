// Reading and changing which archetypes the tarot concepts sit under. Server code only: it imports the database.
// Used by /api/archetypes/concepts, which checks that the caller is an admin first (concepts are shared by every
// account), and kept apart from the route so the logic can be run without a session.

import { query, withTransaction } from "@/lib/db";
import { TAROT_DECK } from "@/lib/cards";
import { cleanSharedRealm } from "@/lib/concept-realm-core";

export const ASPECTS = ["light", "shadow", "neutral"];
export const ACTIONS = ["move", "aspect", "add", "remove", "primary", "realm"];

export interface ConceptRow {
  id: number;
  name: string;
  display_name: string;
  /** The concept's own realm (migration 101); null when it takes its first archetype's. */
  realm: string | null;
  cards: number;
  links: { slug: string; primary: boolean; aspect: string }[];
  /** The cards the concept sits on, in deck order; `reversed` is true where it sits on the card inverted. */
  on_cards: { card: string; name: string; reversed: boolean }[];
}

const DECK_ORDER = new Map(TAROT_DECK.map((c, i) => [c.id, i]));
const CARD_NAME = new Map(TAROT_DECK.map((c) => [c.id, c.name]));

/** Puts the card names on the rows and the cards in deck order (upright before inverted). */
function withCardNames(rows: ConceptRow[]): ConceptRow[] {
  return rows.map((r) => ({
    ...r,
    on_cards: (r.on_cards ?? [])
      .map((o) => ({ card: o.card, name: CARD_NAME.get(o.card) ?? o.card, reversed: o.reversed }))
      .sort((a, b) => (DECK_ORDER.get(a.card) ?? 99) - (DECK_ORDER.get(b.card) ?? 99) || Number(a.reversed) - Number(b.reversed)),
  }));
}

const SELECT_REST = `
         (SELECT COUNT(DISTINCT cc.card_id) FROM card_concepts cc WHERE cc.concept_id = c.id)::int AS cards,
         COALESCE(
           json_agg(json_build_object('slug', a.slug, 'primary', ca.is_primary, 'aspect', ca.aspect)
                    ORDER BY ca.is_primary DESC, a.sort_order) FILTER (WHERE a.id IS NOT NULL),
           '[]'
         ) AS links,
         COALESCE(
           (SELECT json_agg(json_build_object('card', cc.card_id, 'reversed', cc.reversed)) FROM card_concepts cc WHERE cc.concept_id = c.id),
           '[]'
         ) AS on_cards
    FROM concepts c
    LEFT JOIN concept_archetypes ca ON ca.concept_id = c.id
    LEFT JOIN archetypes a ON a.id = ca.archetype_id`;

async function select(): Promise<string> {
  return `SELECT c.id, c.name, c.display_name, c.realm,${SELECT_REST}`;
}

export async function conceptRowsFor(ids: number[]): Promise<ConceptRow[]> {
  return withCardNames(await query<ConceptRow>(`${await select()} WHERE c.id = ANY($1::int[]) GROUP BY c.id ORDER BY c.name`, [ids]));
}

export interface ConceptFilter { archetype: string; q: string; aspect: string; offset: number; limit: number }

export async function listConcepts(f: ConceptFilter): Promise<{ total: number; rows: ConceptRow[] }> {
  const where: string[] = [];
  const params: unknown[] = [];
  if (f.archetype === "none") {
    where.push("NOT EXISTS (SELECT 1 FROM concept_archetypes x WHERE x.concept_id = c.id)");
  } else if (f.archetype) {
    params.push(f.archetype);
    where.push(`EXISTS (SELECT 1 FROM concept_archetypes x JOIN archetypes y ON y.id = x.archetype_id
                         WHERE x.concept_id = c.id AND y.slug = $${params.length})`);
  }
  if (f.aspect) {
    params.push(f.aspect);
    where.push(`EXISTS (SELECT 1 FROM concept_archetypes x WHERE x.concept_id = c.id AND x.aspect = $${params.length})`);
  }
  if (f.q) {
    params.push(`%${f.q.replace(/[\\%_]/g, (m) => "\\" + m)}%`);
    where.push(`c.name ILIKE $${params.length}`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const [{ n }] = await query<{ n: string }>(`SELECT COUNT(*) AS n FROM concepts c ${clause}`, params);
  const rows = await query<ConceptRow>(
    `${await select()} ${clause} GROUP BY c.id ORDER BY c.name LIMIT ${Math.floor(f.limit)} OFFSET ${Math.floor(f.offset)}`,
    params
  );
  return { total: Number(n), rows: withCardNames(rows) };
}

export interface Change {
  action: string;
  ids: number[];
  /** The archetype for move, add, remove, and primary. */
  slug?: string;
  /** The side for aspect. */
  aspect?: string;
  /** The concept's own realm for realm; null or "" to take its first archetype's again. */
  realm?: string | null;
}

/** Applies one change to some concepts in one transaction. Returns an error message, or null when it worked. */
export async function applyChange(c: Change): Promise<string | null> {
  if (!ACTIONS.includes(c.action)) return "Unknown action";
  if (c.action === "realm") {
    const realm = cleanSharedRealm(c.realm);
    if (!realm.ok) return realm.error;
    await query("UPDATE concepts SET realm = $2 WHERE id = ANY($1::int[])", [c.ids, realm.value]);
    return null;
  }
  let archetypeId: number | null = null;
  if (c.action === "aspect") {
    if (!c.aspect || !ASPECTS.includes(c.aspect)) return "Unknown aspect";
  } else {
    const found = await query<{ id: number }>("SELECT id FROM archetypes WHERE slug = $1", [String(c.slug ?? "")]);
    if (found.length === 0) return "Unknown archetype";
    archetypeId = found[0].id;
  }
  await withTransaction(async (db) => {
    for (const id of c.ids) {
      const { rows: links } = await db.query(
        `SELECT ca.archetype_id, ca.is_primary, ca.aspect FROM concept_archetypes ca
           JOIN archetypes a ON a.id = ca.archetype_id WHERE ca.concept_id = $1 ORDER BY ca.is_primary DESC, a.sort_order`,
        [id]
      );
      const aspect: string = links[0]?.aspect ?? "light";

      if (c.action === "aspect") {
        await db.query("UPDATE concept_archetypes SET aspect = $2 WHERE concept_id = $1", [id, c.aspect]);
      } else if (c.action === "move") {
        const oldFirst = links.find((l) => l.is_primary);
        if (oldFirst && oldFirst.archetype_id !== archetypeId) {
          await db.query("DELETE FROM concept_archetypes WHERE concept_id = $1 AND archetype_id = $2", [id, oldFirst.archetype_id]);
        }
        await db.query("UPDATE concept_archetypes SET is_primary = FALSE WHERE concept_id = $1", [id]);
        await db.query(
          `INSERT INTO concept_archetypes (concept_id, archetype_id, aspect, is_primary) VALUES ($1, $2, $3, TRUE)
           ON CONFLICT (concept_id, archetype_id) DO UPDATE SET is_primary = TRUE`,
          [id, archetypeId, aspect]
        );
      } else if (c.action === "add") {
        await db.query(
          `INSERT INTO concept_archetypes (concept_id, archetype_id, aspect, is_primary) VALUES ($1, $2, $3, $4)
           ON CONFLICT (concept_id, archetype_id) DO NOTHING`,
          [id, archetypeId, aspect, links.length === 0]
        );
      } else if (c.action === "remove") {
        const had = links.find((l) => l.archetype_id === archetypeId);
        if (had) {
          await db.query("DELETE FROM concept_archetypes WHERE concept_id = $1 AND archetype_id = $2", [id, archetypeId]);
          const next = links.find((l) => l.archetype_id !== archetypeId);
          if (had.is_primary && next) {
            await db.query("UPDATE concept_archetypes SET is_primary = TRUE WHERE concept_id = $1 AND archetype_id = $2", [id, next.archetype_id]);
          }
        }
      } else if (c.action === "primary") {
        if (links.some((l) => l.archetype_id === archetypeId)) {
          await db.query("UPDATE concept_archetypes SET is_primary = FALSE WHERE concept_id = $1", [id]);
          await db.query("UPDATE concept_archetypes SET is_primary = TRUE WHERE concept_id = $1 AND archetype_id = $2", [id, archetypeId]);
        }
      }
    }
  });
  return null;
}
