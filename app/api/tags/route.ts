import { NextRequest } from "next/server";
import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { jsonBody } from "@/lib/own-http";

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const tags = await query(
    "SELECT * FROM tags WHERE user_id = $1 ORDER BY name ASC",
    [session.userId]
  );
  return Response.json(tags);
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const { name, color } = sent;
  if (!name?.trim()) return Response.json({ error: "name is required" }, { status: 400 });
  const tag = await queryOne(
    "INSERT INTO tags (user_id, name, color) VALUES ($1, $2, $3) ON CONFLICT (user_id, name) DO UPDATE SET color = EXCLUDED.color RETURNING *",
    [session.userId, name.trim(), color ?? "#7c3aed"]
  );
  return Response.json(tag, { status: 201 });
}
