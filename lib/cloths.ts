import { query, queryOne, withTransaction } from "./db";
import { CLOTH_KINDS, MAX_CLOTHS, cleanGeom, type ClothCountRow, type ClothKind, type Facing, type ItemRef, type PlacementInput, type Zone, isClothKind } from "./cloth-core";
import { faceLabel, getObject } from "./dice-data";

// Cloths, the database side (migration 077). Every function takes the signed-in person's id and filters by it, so a route cannot reach another
// person's cloth or placements. Server code only; the browser uses lib/cloth-core.ts.


export interface ClothSummary {
  id: number;
  name: string;
  description: string | null;
  zones: number;
  updated_at: string;
}

export interface Cloth {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  zones: Zone[];
}

export async function listCloths(userId: number): Promise<ClothSummary[]> {
  return query<ClothSummary>(
    `SELECT c.id, c.name, c.description, c.updated_at,
            (SELECT COUNT(*)::int FROM cloth_zones z WHERE z.cloth_id = c.id) AS zones
     FROM cloths c WHERE c.user_id = $1 ORDER BY c.updated_at DESC, c.id DESC`,
    [userId]
  );
}

interface ZoneRow {
  name: string;
  note: string | null;
  color: string | null;
  geom: unknown;
}

/** One cloth with its zones in order, or null. A zone whose stored shape no longer passes the checks is left out rather than shown wrongly. */
export async function loadCloth(userId: number, id: number): Promise<Cloth | null> {
  const cloth = await queryOne<Omit<Cloth, "zones">>("SELECT id, name, description, created_at, updated_at FROM cloths WHERE id = $1 AND user_id = $2", [id, userId]);
  if (!cloth) return null;
  const rows = await query<ZoneRow>("SELECT name, note, color, geom FROM cloth_zones WHERE cloth_id = $1 AND user_id = $2 ORDER BY sort_order, id", [id, userId]);
  const zones: Zone[] = [];
  for (const r of rows) {
    const g = cleanGeom(r.geom);
    if (g.ok) zones.push({ name: r.name, note: r.note, color: r.color, geom: g.geom });
  }
  return { ...cloth, zones };
}

async function writeZones(client: { query: (sql: string, params: unknown[]) => Promise<unknown> }, userId: number, clothId: number, zones: Zone[]) {
  let order = 0;
  for (const z of zones) {
    await client.query(
      "INSERT INTO cloth_zones (user_id, cloth_id, name, note, color, geom, sort_order) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)",
      [userId, clothId, z.name, z.note, z.color, JSON.stringify(z.geom), order++]
    );
  }
}

/** Makes a cloth. Null when the person already has the most they may keep. */
export async function createCloth(userId: number, input: { name: string; description: string | null; zones: Zone[] }): Promise<number | null> {
  return withTransaction(async (client) => {
    const { rows: n } = await client.query("SELECT COUNT(*)::int AS n FROM cloths WHERE user_id = $1", [userId]);
    if (n[0].n >= MAX_CLOTHS) return null;
    const { rows } = await client.query("INSERT INTO cloths (user_id, name, description) VALUES ($1, $2, $3) RETURNING id", [userId, input.name, input.description]);
    await writeZones(client, userId, rows[0].id, input.zones);
    return rows[0].id as number;
  });
}

/** Replaces a cloth's name, description and zones. False when it is not the person's. Placements keep the names they were recorded with. */
export async function updateCloth(userId: number, id: number, input: { name: string; description: string | null; zones: Zone[] }): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query("UPDATE cloths SET name = $3, description = $4, updated_at = NOW() WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId, input.name, input.description]);
    if (!rows[0]) return false;
    await client.query("DELETE FROM cloth_zones WHERE cloth_id = $1 AND user_id = $2", [id, userId]);
    await writeZones(client, userId, id, input.zones);
    return true;
  });
}

/** Deletes a cloth and its zones. Where items landed stays (the placements keep the cloth's name and lose only the link). */
export async function deleteCloth(userId: number, id: number): Promise<boolean> {
  const row = await queryOne("DELETE FROM cloths WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return !!row;
}

// ── The items of a reading ───────────────────────────────────────────────────────────────────────────

/** One of the person's readings whose items can be tossed onto a cloth, for the Tossing lots page. */
export interface TossableReading {
  id: number;
  kind: ClothKind;
  question: string | null;
  summary: string | null;
  reading_id: number | null;
  created_at: string;
  /** The cloth its landings were recorded on, or null when nothing is recorded yet. */
  tossed_on: string | null;
}

/** The person's newest readings made with a tool that has items (CLOTH_KINDS), with the cloth each was tossed on if any. */
export async function listTossable(userId: number, limit = 40): Promise<TossableReading[]> {
  return query<TossableReading>(
    `SELECT d.id, d.kind, d.question, d.summary, d.reading_id, d.created_at,
            (SELECT p.cloth_name FROM cloth_placements p WHERE p.divination_id = d.id AND p.user_id = d.user_id LIMIT 1) AS tossed_on
     FROM divinations d WHERE d.user_id = $1 AND d.kind = ANY($2::text[])
     ORDER BY d.created_at DESC, d.id DESC LIMIT $3`,
    [userId, [...CLOTH_KINDS], limit]
  );
}

/** One reading for the Tossing lots page: the person's own, and of a kind that has items. Null otherwise. */
export async function loadTossable(userId: number, divinationId: number): Promise<TossableReading | null> {
  const row = await queryOne<TossableReading>(
    `SELECT d.id, d.kind, d.question, d.summary, d.reading_id, d.created_at, NULL AS tossed_on
     FROM divinations d WHERE d.id = $1 AND d.user_id = $2`,
    [divinationId, userId]
  );
  return row && isClothKind(row.kind) ? row : null;
}

/** The kind of a reading, if it is one that can be recorded on a cloth and is the person's own. */
export async function clothKindOf(userId: number, divinationId: number): Promise<ClothKind | null> {
  const row = await queryOne<{ kind: string }>("SELECT kind FROM divinations WHERE id = $1 AND user_id = $2", [divinationId, userId]);
  return row && isClothKind(row.kind) ? row.kind : null;
}

/** The items of a reading, in the order they came up, named as they were then. Only the person's own reading. */
export async function itemsOf(userId: number, divinationId: number, kind: ClothKind): Promise<ItemRef[]> {
  const turned = (name: string, reversed: number) => (reversed ? `${name} (reversed)` : name);
  if (kind === "runes") {
    const rows = await query<{ rune_name: string; reversed: number }>("SELECT rune_name, reversed FROM rune_draws WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id", [divinationId, userId]);
    return rows.map((r, index) => ({ index, label: turned(r.rune_name, r.reversed) }));
  }
  if (kind === "ogham") {
    const rows = await query<{ stave_name: string }>("SELECT stave_name FROM ogham_draws WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id", [divinationId, userId]);
    return rows.map((r, index) => ({ index, label: r.stave_name }));
  }
  if (kind === "oracle") {
    const rows = await query<{ card_name: string; reversed: number }>("SELECT card_name, reversed FROM oracle_pull_cards WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id", [divinationId, userId]);
    return rows.map((r, index) => ({ index, label: turned(r.card_name, r.reversed) }));
  }
  if (kind === "tarot") {
    // The cards of the spread in the order they were laid; a clarifier is not a card the person threw. Its upside-down mark stays in the label.
    const rows = await query<{ card_name: string; reversed: number }>(
      `SELECT cd.card_name, cd.reversed FROM card_draws cd JOIN divinations d ON d.reading_id = cd.reading_id
       WHERE d.id = $1 AND d.user_id = $2 AND cd.user_id = $2 AND cd.is_clarifier = 0 ORDER BY cd.id`,
      [divinationId, userId]
    );
    return rows.map((r, index) => ({ index, label: turned(r.card_name, r.reversed) }));
  }
  if (kind === "playingcards") {
    const rows = await query<{ card_name: string }>("SELECT card_name FROM playing_card_draws WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id", [divinationId, userId]);
    return rows.map((r, index) => ({ index, label: r.card_name }));
  }
  if (kind === "charms") {
    const rows = await query<{ charm_name: string }>("SELECT charm_name FROM charm_casts WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id", [divinationId, userId]);
    return rows.map((r, index) => ({ index, label: r.charm_name }));
  }
  const rows = await query<{ object: string; face: string }>("SELECT object, face FROM dice_throws WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id", [divinationId, userId]);
  return rows.map((r, index) => ({ index, label: `${getObject(r.object)?.name ?? r.object}: ${faceLabel(r.face)}` }));
}

/** Where the app's own cast put each charm (0 to 1000 each way, the same square as a cloth) and which side showed, in the order of itemsOf. */
export async function charmLandings(userId: number, divinationId: number): Promise<{ x: number; y: number; face: Facing }[]> {
  return query<{ x: number; y: number; face: Facing }>(
    "SELECT x, y, face FROM charm_casts WHERE divination_id = $1 AND user_id = $2 ORDER BY sort_order, id",
    [divinationId, userId]
  );
}

// ── Where the items landed ───────────────────────────────────────────────────────────────────────────

export interface PlacementRow {
  item_index: number;
  item_label: string;
  where_kind: "zone" | "none" | "off";
  zone_name: string | null;
  x: number | null;
  y: number | null;
  facing: Facing | null;
  simulated: boolean;
}

/** What is recorded for a reading, with the cloth it was recorded on. Null when nothing is. */
export async function placementsOf(userId: number, divinationId: number): Promise<{ cloth_id: number | null; cloth_name: string; rows: PlacementRow[] } | null> {
  const rows = await query<PlacementRow & { cloth_id: number | null; cloth_name: string }>(
    `SELECT item_index, item_label, where_kind, zone_name, x, y, facing, simulated, cloth_id, cloth_name
     FROM cloth_placements WHERE divination_id = $1 AND user_id = $2 ORDER BY item_index`,
    [divinationId, userId]
  );
  if (!rows.length) return null;
  return { cloth_id: rows[0].cloth_id, cloth_name: rows[0].cloth_name, rows };
}

/** Replaces what is recorded for a reading with `list`, on one cloth. The items' labels are copied from the reading, not from the browser. */
export async function savePlacements(
  userId: number, divinationId: number, cloth: { id: number; name: string }, items: ItemRef[], list: PlacementInput[]
): Promise<void> {
  const labelOf = new Map(items.map((i) => [i.index, i.label]));
  await withTransaction(async (client) => {
    await client.query("DELETE FROM cloth_placements WHERE divination_id = $1 AND user_id = $2", [divinationId, userId]);
    for (const p of list) {
      await client.query(
        `INSERT INTO cloth_placements (user_id, divination_id, item_index, item_label, cloth_id, cloth_name, where_kind, zone_name, x, y, facing, simulated)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [userId, divinationId, p.index, labelOf.get(p.index) ?? `Item ${p.index + 1}`, cloth.id, cloth.name, p.where, p.zone, p.x, p.y, p.facing, p.simulated]
      );
    }
  });
}

export async function clearPlacements(userId: number, divinationId: number): Promise<void> {
  await query("DELETE FROM cloth_placements WHERE divination_id = $1 AND user_id = $2", [divinationId, userId]);
}

export interface ZoneCount {
  where_kind: "zone" | "none" | "off";
  zone_name: string | null;
  n: number;
}

/**
 * Every placement the person recorded, grouped by cloth, tool and zone, for Patterns.
 * The tool comes from the reading (`divinations.kind`), so the page can follow the tools the person is showing.
 */
export async function allClothCounts(userId: number): Promise<ClothCountRow[]> {
  return query<ClothCountRow>(
    `SELECT p.cloth_id, p.cloth_name, d.kind, p.where_kind, p.zone_name, COUNT(*)::int AS n
     FROM cloth_placements p JOIN divinations d ON d.id = p.divination_id AND d.user_id = p.user_id
     WHERE p.user_id = $1
     GROUP BY p.cloth_id, p.cloth_name, d.kind, p.where_kind, p.zone_name`,
    [userId]
  );
}

/** How many items have landed in each zone of a cloth, over every reading, as plain counts (open item T4, step 4). */
export async function zoneCounts(userId: number, clothId: number): Promise<{ counts: ZoneCount[]; readings: number }> {
  const counts = await query<ZoneCount>(
    `SELECT where_kind, zone_name, COUNT(*)::int AS n FROM cloth_placements
     WHERE user_id = $1 AND cloth_id = $2 GROUP BY where_kind, zone_name ORDER BY n DESC, zone_name`,
    [userId, clothId]
  );
  const r = await queryOne<{ n: number }>("SELECT COUNT(DISTINCT divination_id)::int AS n FROM cloth_placements WHERE user_id = $1 AND cloth_id = $2", [userId, clothId]);
  return { counts, readings: r?.n ?? 0 };
}
