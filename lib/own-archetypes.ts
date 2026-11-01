// A person's own archetypes, concepts and links to pieces (migration 060), in the database. Server code only. Every query
// is for one person (`userId` from the session); nothing here reads or writes the shared archetypes, concepts or symbol
// links. The cleaning of what comes in, and the limits, are in lib/own-archetypes-core.ts.

import { query, queryOne, withTransaction } from "@/lib/db";
import {
  LIMITS, atLimit, type ArchetypeInput, type Aspect, type ConceptInput, type LinkInput, type LinkPiece, type LinkTarget,
} from "@/lib/own-archetypes-core";

export type Failure = "limit" | "duplicate" | "notfound";
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: Failure };

const ok = <T>(value: T): Outcome<T> => ({ ok: true, value });
const fail = <T>(error: Failure): Outcome<T> => ({ ok: false, error });
const isDuplicate = (e: unknown) => (e as { code?: string } | null)?.code === "23505";

export interface OwnArchetype {
  id: number;
  name: string;
  realm: string | null;
  summary: string;
  light: string;
  shadow: string;
  created_at: string;
  updated_at: string;
  concepts: number;
  links: number;
}

export interface OwnConcept {
  id: number;
  name: string;
  description: string;
  shared_archetype: { slug: string; name: string } | null;
  user_archetype: { id: number; name: string } | null;
  /** The person's own realm for it (migration 101), or null. */
  realm: string | null;
  /** The realm of the archetype it sits under, shown when it has none of its own. */
  inherited_realm: string | null;
  links: number;
  created_at: string;
  updated_at: string;
}

export interface OwnLink {
  id: number;
  /** For one of the person's own oracle items, its name too. */
  piece: LinkPiece & { name?: string };
  target: { kind: "archetype"; slug: string; name: string } | { kind: "user_archetype"; id: number; name: string } | { kind: "user_concept"; id: number; name: string };
  aspect: Aspect;
}

// ------------------------------------------------------------------ archetypes

export function listOwnArchetypes(userId: number): Promise<OwnArchetype[]> {
  return query<OwnArchetype>(
    `SELECT a.id, a.name, a.realm, a.summary, a.light, a.shadow, a.created_at, a.updated_at,
            (SELECT COUNT(*)::int FROM user_concepts c WHERE c.user_archetype_id = a.id AND c.user_id = a.user_id) AS concepts,
            (SELECT COUNT(*)::int FROM user_symbol_links l WHERE l.user_archetype_id = a.id AND l.user_id = a.user_id) AS links
       FROM user_archetypes a WHERE a.user_id = $1 ORDER BY lower(a.name)`,
    [userId]
  );
}

export async function createOwnArchetype(userId: number, input: ArchetypeInput): Promise<Outcome<{ id: number }>> {
  return withTransaction(async (client) => {
    // One person's creations are counted under a lock on their own account row, so two at once cannot both pass the limit.
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const { rows: [{ n }] } = await client.query("SELECT COUNT(*)::int AS n FROM user_archetypes WHERE user_id = $1", [userId]);
    if (atLimit(n, LIMITS.archetypes)) return fail<{ id: number }>("limit");
    try {
      const { rows } = await client.query(
        `INSERT INTO user_archetypes (user_id, name, realm, summary, light, shadow) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [userId, input.name, input.realm, input.summary, input.light, input.shadow]
      );
      return ok({ id: rows[0].id as number });
    } catch (e) {
      if (isDuplicate(e)) return fail<{ id: number }>("duplicate");
      throw e;
    }
  });
}

export async function updateOwnArchetype(userId: number, id: number, input: ArchetypeInput): Promise<Outcome<true>> {
  try {
    const row = await queryOne(
      `UPDATE user_archetypes SET name=$3, realm=$4, summary=$5, light=$6, shadow=$7, updated_at=NOW()
        WHERE id=$1 AND user_id=$2 RETURNING id`,
      [id, userId, input.name, input.realm, input.summary, input.light, input.shadow]
    );
    return row ? ok(true as const) : fail("notfound");
  } catch (e) {
    if (isDuplicate(e)) return fail("duplicate");
    throw e;
  }
}

/** Removes the archetype and every link to it. Its concepts stay, with no archetype. */
export async function deleteOwnArchetype(userId: number, id: number): Promise<boolean> {
  return !!(await queryOne("DELETE FROM user_archetypes WHERE id=$1 AND user_id=$2 RETURNING id", [id, userId]));
}

// ------------------------------------------------------------------ concepts

export async function listOwnConcepts(userId: number): Promise<OwnConcept[]> {
  const rows = await query<{
    id: number; name: string; description: string; slug: string | null; shared_name: string | null;
    ua_id: number | null; ua_name: string | null; realm: string | null; inherited_realm: string | null; links: number; created_at: string; updated_at: string;
  }>(
    `SELECT c.id, c.name, c.description, s.slug, s.name AS shared_name, ua.id AS ua_id, ua.name AS ua_name,
            c.realm, COALESCE(ua.realm, s.realm) AS inherited_realm,
            (SELECT COUNT(*)::int FROM user_symbol_links l WHERE l.user_concept_id = c.id AND l.user_id = c.user_id) AS links,
            c.created_at, c.updated_at
       FROM user_concepts c
       LEFT JOIN archetypes s ON s.id = c.shared_archetype_id
       LEFT JOIN user_archetypes ua ON ua.id = c.user_archetype_id AND ua.user_id = c.user_id
      WHERE c.user_id = $1 ORDER BY lower(c.name)`,
    [userId]
  );
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    shared_archetype: r.slug ? { slug: r.slug, name: r.shared_name! } : null,
    user_archetype: r.ua_id ? { id: r.ua_id, name: r.ua_name! } : null,
    realm: r.realm,
    inherited_realm: r.inherited_realm,
    links: r.links,
    created_at: r.created_at,
    updated_at: r.updated_at,
  }));
}

/** Resolves a concept's parent: a shared archetype by slug, or one of the person's own by id. Returns null for "none". */
async function parentOf(
  userId: number, input: ConceptInput
): Promise<{ shared: number | null; own: number | null } | "notfound"> {
  let shared: number | null = null;
  let own: number | null = null;
  if (input.sharedSlug) {
    const a = await queryOne<{ id: number }>("SELECT id FROM archetypes WHERE slug = $1", [input.sharedSlug]);
    if (!a) return "notfound";
    shared = a.id;
  }
  if (input.userArchetypeId !== null) {
    const a = await queryOne<{ id: number }>("SELECT id FROM user_archetypes WHERE id = $1 AND user_id = $2", [input.userArchetypeId, userId]);
    if (!a) return "notfound";
    own = a.id;
  }
  return { shared, own };
}

export async function createOwnConcept(userId: number, input: ConceptInput): Promise<Outcome<{ id: number }>> {
  const parent = await parentOf(userId, input);
  if (parent === "notfound") return fail("notfound");
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const { rows: [{ n }] } = await client.query("SELECT COUNT(*)::int AS n FROM user_concepts WHERE user_id = $1", [userId]);
    if (atLimit(n, LIMITS.concepts)) return fail<{ id: number }>("limit");
    try {
      const { rows } = await client.query(
        `INSERT INTO user_concepts (user_id, name, description, shared_archetype_id, user_archetype_id, realm) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
        [userId, input.name, input.description, parent.shared, parent.own, input.realm]
      );
      return ok({ id: rows[0].id as number });
    } catch (e) {
      if (isDuplicate(e)) return fail<{ id: number }>("duplicate");
      throw e;
    }
  });
}

export async function updateOwnConcept(userId: number, id: number, input: ConceptInput): Promise<Outcome<true>> {
  const parent = await parentOf(userId, input);
  if (parent === "notfound") return fail("notfound");
  try {
    const row = await queryOne(
      `UPDATE user_concepts SET name=$3, description=$4, shared_archetype_id=$5, user_archetype_id=$6, realm=$7, updated_at=NOW()
        WHERE id=$1 AND user_id=$2 RETURNING id`,
      [id, userId, input.name, input.description, parent.shared, parent.own, input.realm]
    );
    return row ? ok(true as const) : fail("notfound");
  } catch (e) {
    if (isDuplicate(e)) return fail("duplicate");
    throw e;
  }
}

/** Removes the concept and every link to it. */
export async function deleteOwnConcept(userId: number, id: number): Promise<boolean> {
  return !!(await queryOne("DELETE FROM user_concepts WHERE id=$1 AND user_id=$2 RETURNING id", [id, userId]));
}

// ------------------------------------------------------------------ links

interface LinkRow {
  id: number;
  symbol_id: string | null;
  oracle_card_id: number | null;
  oracle_name: string | null;
  aspect: Aspect;
  slug: string | null;
  shared_name: string | null;
  ua_id: number | null;
  ua_name: string | null;
  uc_id: number | null;
  uc_name: string | null;
}

const LINK_SELECT = `
  SELECT l.id, l.symbol_id, l.oracle_card_id, oc.name AS oracle_name, l.aspect,
         s.slug, s.name AS shared_name, ua.id AS ua_id, ua.name AS ua_name, uc.id AS uc_id, uc.name AS uc_name
    FROM user_symbol_links l
    LEFT JOIN oracle_cards oc ON oc.id = l.oracle_card_id AND oc.user_id = l.user_id
    LEFT JOIN archetypes s ON s.id = l.archetype_id
    LEFT JOIN user_archetypes ua ON ua.id = l.user_archetype_id AND ua.user_id = l.user_id
    LEFT JOIN user_concepts uc ON uc.id = l.user_concept_id AND uc.user_id = l.user_id`;

function toLink(r: LinkRow): OwnLink {
  return {
    id: r.id,
    piece: r.symbol_id
      ? { kind: "symbol", id: r.symbol_id }
      : { kind: "oracle_card", id: r.oracle_card_id!, ...(r.oracle_name ? { name: r.oracle_name } : {}) },
    target: r.slug
      ? { kind: "archetype", slug: r.slug, name: r.shared_name! }
      : r.ua_id
        ? { kind: "user_archetype", id: r.ua_id, name: r.ua_name! }
        : { kind: "user_concept", id: r.uc_id!, name: r.uc_name! },
    aspect: r.aspect,
  };
}

/** The person's own links from one piece. */
export async function linksForPiece(userId: number, piece: LinkPiece): Promise<OwnLink[]> {
  const rows = await query<LinkRow>(
    `${LINK_SELECT} WHERE l.user_id = $1 AND ${piece.kind === "symbol" ? "l.symbol_id" : "l.oracle_card_id"} = $2 ORDER BY l.id`,
    [userId, piece.id]
  );
  return rows.map(toLink);
}

/** All of the person's own links (for the export, Patterns, and the archetype pages). */
export async function allOwnLinks(userId: number): Promise<OwnLink[]> {
  return (await query<LinkRow>(`${LINK_SELECT} WHERE l.user_id = $1 ORDER BY l.id`, [userId])).map(toLink);
}

async function resolveTarget(userId: number, t: LinkTarget): Promise<{ col: "archetype_id" | "user_archetype_id" | "user_concept_id"; id: number } | null> {
  if (t.kind === "archetype") {
    const a = await queryOne<{ id: number }>("SELECT id FROM archetypes WHERE slug = $1", [t.slug]);
    return a ? { col: "archetype_id", id: a.id } : null;
  }
  if (t.kind === "user_archetype") {
    const a = await queryOne<{ id: number }>("SELECT id FROM user_archetypes WHERE id = $1 AND user_id = $2", [t.id, userId]);
    return a ? { col: "user_archetype_id", id: a.id } : null;
  }
  const c = await queryOne<{ id: number }>("SELECT id FROM user_concepts WHERE id = $1 AND user_id = $2", [t.id, userId]);
  return c ? { col: "user_concept_id", id: c.id } : null;
}

export async function addOwnLink(userId: number, input: LinkInput): Promise<Outcome<{ id: number }>> {
  const target = await resolveTarget(userId, input.target);
  if (!target) return fail("notfound");
  if (input.piece.kind === "oracle_card") {
    const own = await queryOne("SELECT id FROM oracle_cards WHERE id = $1 AND user_id = $2", [input.piece.id, userId]);
    if (!own) return fail("notfound");
  }
  return withTransaction(async (client) => {
    await client.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [userId]);
    const { rows: [{ n }] } = await client.query("SELECT COUNT(*)::int AS n FROM user_symbol_links WHERE user_id = $1", [userId]);
    if (atLimit(n, LIMITS.links)) return fail<{ id: number }>("limit");
    try {
      const { rows } = await client.query(
        `INSERT INTO user_symbol_links (user_id, symbol_id, oracle_card_id, ${target.col}, aspect) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [
          userId,
          input.piece.kind === "symbol" ? input.piece.id : null,
          input.piece.kind === "oracle_card" ? input.piece.id : null,
          target.id,
          input.aspect,
        ]
      );
      return ok({ id: rows[0].id as number });
    } catch (e) {
      if (isDuplicate(e)) return fail<{ id: number }>("duplicate");
      throw e;
    }
  });
}

export async function removeOwnLink(userId: number, id: number): Promise<boolean> {
  return !!(await queryOne("DELETE FROM user_symbol_links WHERE id=$1 AND user_id=$2 RETURNING id", [id, userId]));
}
