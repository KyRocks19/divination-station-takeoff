import { query } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonBody } from "@/lib/own-http";

// Ensure table exists (idempotent)
async function ensureTable() {
  await query(
    `CREATE TABLE IF NOT EXISTS graph_positions (
       user_id  INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
       node_id  TEXT    NOT NULL,
       x        DOUBLE PRECISION NOT NULL,
       y        DOUBLE PRECISION NOT NULL,
       PRIMARY KEY (user_id, node_id)
     )`,
    []
  );
}

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({}, { status: 401 });

  await ensureTable();
  const rows = await query(
    "SELECT node_id, x, y FROM graph_positions WHERE user_id = $1",
    [session.userId]
  ) as { node_id: string; x: number; y: number }[];

  const out: Record<string, { x: number; y: number }> = {};
  for (const r of rows) out[r.node_id] = { x: r.x, y: r.y };
  return Response.json(out);
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return Response.json({}, { status: 401 });

  await ensureTable();
  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const positions: Record<string, { x: number; y: number }> = sent;
  // At most one place per concept or card, each a pair of ordinary numbers; anything else is left out.
  const entries = Object.entries(positions ?? {})
    .filter(([id, p]) => id.length <= 60 && Number.isFinite(p?.x) && Number.isFinite(p?.y))
    .slice(0, 500);
  if (entries.length === 0) return Response.json({ ok: true });

  const nodeIds = entries.map(([id]) => id);
  const xs = entries.map(([, { x }]) => x);
  const ys = entries.map(([, { y }]) => y);

  await query(
    `INSERT INTO graph_positions (user_id, node_id, x, y)
     SELECT $1, unnest($2::text[]), unnest($3::float8[]), unnest($4::float8[])
     ON CONFLICT (user_id, node_id) DO UPDATE SET x = EXCLUDED.x, y = EXCLUDED.y`,
    [session.userId, nodeIds, xs, ys]
  );

  return Response.json({ ok: true });
}

export async function DELETE() {
  const session = await getSession();
  if (!session.userId) return Response.json({}, { status: 401 });

  await ensureTable();
  await query("DELETE FROM graph_positions WHERE user_id = $1", [session.userId]);
  return Response.json({ ok: true });
}
