import { query, queryOne, withTransaction } from "./db";
import { MAX_POSITIONS, MAX_NAME_LENGTH, MAX_TEXT_LENGTH, BOARD_MAX, cleanColor } from "./layouts-shared";

// Layouts (migration 029): a person's own named positions. One layout can serve any tool that draws several things
// (runes, ogham, the oracle deck, and later tools). A draw with a layout draws one item per position and keeps each
// position's name, and the layout's name, as they were at the time. The app supplies no layouts and no position names.

export { MAX_POSITIONS, MAX_NAME_LENGTH, MAX_TEXT_LENGTH } from "./layouts-shared";

export interface LayoutPosition {
  id: number;
  name: string;
  /** The person's own question for this position. */
  prompt: string | null;
  sort_order: number;
  /** The person's own colour for this position, as #rrggbb, or null to use the tool's default. */
  color: string | null;
  /** Where this position sits on a board, in board units, or null when the layout is a plain list. */
  x: number | null;
  y: number | null;
  /** Degrees the card is turned on the board (0 when upright). */
  rotation: number | null;
}

export interface Layout {
  id: number;
  name: string;
  description: string | null;
  /** The person's own starting question for a draw with this layout. */
  question: string | null;
  created_at: string;
  updated_at: string;
  positions: LayoutPosition[];
}

/** What a person sends when they make or change a layout. */
export interface LayoutInput {
  name: string;
  description: string | null;
  question: string | null;
  positions: { name: string; prompt: string | null; color: string | null; x: number | null; y: number | null; rotation: number | null }[];
}

function boardNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) && n >= 0 && n <= BOARD_MAX ? n : null;
}

function text(value: unknown, max: number): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
}

/** Checks what a person sent. Returns the cleaned layout, or a message saying what is wrong. */
export function cleanLayoutInput(body: unknown): LayoutInput | string {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b !== "object") return "Invalid JSON";
  const name = text(b.name, MAX_NAME_LENGTH);
  if (!name) return "A layout needs a name";
  if (!Array.isArray(b.positions) || b.positions.length === 0) return "A layout needs at least one position";
  if (b.positions.length > MAX_POSITIONS) return `A layout can have at most ${MAX_POSITIONS} positions`;
  const positions: LayoutInput["positions"] = [];
  for (const p of b.positions as Record<string, unknown>[]) {
    const pname = text(p?.name, MAX_NAME_LENGTH);
    if (!pname) return "Every position needs a name";
    // A place on the board needs both x and y; a turn means nothing without one.
    const px = boardNumber(p?.x);
    const py = boardNumber(p?.y);
    const placed = px !== null && py !== null;
    const turn = Number(p?.rotation);
    positions.push({
      name: pname,
      prompt: text(p?.prompt, MAX_TEXT_LENGTH),
      color: cleanColor(p?.color),
      x: placed ? px : null,
      y: placed ? py : null,
      rotation: placed ? (Number.isFinite(turn) ? ((Math.round(turn) % 360) + 360) % 360 : 0) : null,
    });
  }
  // A board needs every position placed; a half-placed layout would draw some cards nowhere.
  const placedCount = positions.filter((p) => p.x !== null).length;
  if (placedCount !== 0 && placedCount !== positions.length) return "Place every position on the board, or none of them";
  return { name, description: text(b.description, MAX_TEXT_LENGTH), question: text(b.question, MAX_TEXT_LENGTH), positions };
}

async function withPositions(userId: number, layouts: Omit<Layout, "positions">[]): Promise<Layout[]> {
  if (layouts.length === 0) return [];
  const rows = await query<LayoutPosition & { layout_id: number }>(
    `SELECT id, layout_id, name, prompt, sort_order, color, x, y, rotation
     FROM layout_positions
     WHERE user_id = $1 AND layout_id = ANY($2)
     ORDER BY sort_order ASC, id ASC`,
    [userId, layouts.map((l) => l.id)]
  );
  return layouts.map((l) => ({
    ...l,
    positions: rows
      .filter((r) => r.layout_id === l.id)
      .map(({ id, name, prompt, sort_order, color, x, y, rotation }) => ({ id, name, prompt, sort_order, color, x, y, rotation })),
  }));
}

const LAYOUT_COLUMNS = "id, name, description, question, created_at, updated_at";

/** The person's layouts, oldest first, each with its positions. */
export async function listLayouts(userId: number): Promise<Layout[]> {
  const layouts = await query<Omit<Layout, "positions">>(
    `SELECT ${LAYOUT_COLUMNS} FROM layouts WHERE user_id = $1 ORDER BY created_at ASC, id ASC`,
    [userId]
  );
  return withPositions(userId, layouts);
}

/** One layout, or null when it is not theirs. */
export async function loadLayout(userId: number, id: number): Promise<Layout | null> {
  if (!id) return null;
  const layout = await queryOne<Omit<Layout, "positions">>(
    `SELECT ${LAYOUT_COLUMNS} FROM layouts WHERE id = $1 AND user_id = $2`,
    [id, userId]
  );
  return layout ? (await withPositions(userId, [layout]))[0] : null;
}

/** Makes a layout with its positions in one step. */
export async function createLayout(userId: number, input: LayoutInput): Promise<number> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      "INSERT INTO layouts (user_id, name, description, question) VALUES ($1, $2, $3, $4) RETURNING id",
      [userId, input.name, input.description, input.question]
    );
    const id = rows[0].id as number;
    await insertPositions(client, userId, id, input.positions);
    return id;
  });
}

/**
 * Changes a layout. The positions are replaced as a whole: draws keep position names as text, so nothing points at
 * a position row. Returns false when the layout is not theirs.
 */
export async function updateLayout(userId: number, id: number, input: LayoutInput): Promise<boolean> {
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE layouts SET name = $1, description = $2, question = $3, updated_at = NOW()
       WHERE id = $4 AND user_id = $5 RETURNING id`,
      [input.name, input.description, input.question, id, userId]
    );
    if (rows.length === 0) return false;
    await client.query("DELETE FROM layout_positions WHERE layout_id = $1 AND user_id = $2", [id, userId]);
    await insertPositions(client, userId, id, input.positions);
    return true;
  });
}

// One statement for all the positions, so a layout of thousands is as quick to save as a layout of three.
async function insertPositions(
  client: { query: (sql: string, params: unknown[]) => Promise<unknown> },
  userId: number,
  layoutId: number,
  positions: LayoutInput["positions"]
) {
  await client.query(
    `INSERT INTO layout_positions (user_id, layout_id, name, prompt, sort_order, color, x, y, rotation)
     SELECT $1, $2, t.name, t.prompt, t.ord, t.color, t.x, t.y, t.rotation
     FROM unnest($3::text[], $4::text[], $5::int[], $6::text[], $7::int[], $8::int[], $9::int[]) AS t(name, prompt, ord, color, x, y, rotation)`,
    [
      userId,
      layoutId,
      positions.map((p) => p.name),
      positions.map((p) => p.prompt),
      positions.map((_, i) => i),
      positions.map((p) => p.color),
      positions.map((p) => p.x),
      positions.map((p) => p.y),
      positions.map((p) => p.rotation),
    ]
  );
}

/** Deletes a layout. Readings made with it stay, with the layout's and positions' names as they were. */
export async function deleteLayout(userId: number, id: number): Promise<boolean> {
  const rows = await query("DELETE FROM layouts WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]);
  return rows.length > 0;
}

/**
 * Looks up the layout a person chose for a draw and checks it fits the set being drawn from. `setSize` is how many
 * different items the set can give. Returns the layout, or a message and status for the response.
 */
export async function resolveLayout(
  userId: number,
  rawId: unknown,
  setSize: number
): Promise<{ layout: Layout } | { error: string; status: number } | null> {
  if (rawId === undefined || rawId === null || rawId === "") return null;
  const id = typeof rawId === "number" ? rawId : Number(rawId);
  const layout = Number.isInteger(id) ? await loadLayout(userId, id) : null;
  if (!layout) return { error: "Layout not found", status: 404 };
  if (layout.positions.length > setSize) {
    return {
      error: `This layout has ${layout.positions.length} positions, and this set has only ${setSize} to draw from.`,
      status: 400,
    };
  }
  return { layout };
}
