import { getSession } from "@/lib/session";
import { queryOne, query } from "@/lib/db";

const MAX_SIGIL_BYTES = 256 * 1024; // 256 KB — generous for a 200×200 canvas PNG

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const row = await queryOne<{ sigil_data: string | null }>(
    "SELECT sigil_data FROM users WHERE id = $1",
    [session.userId]
  );

  return Response.json({ sigil_data: row?.sigil_data ?? null });
}

export async function POST(req: Request) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  let body: { sigil_data: string | null };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Allow clearing (null) or a valid PNG data URL
  if (body.sigil_data !== null) {
    if (typeof body.sigil_data !== "string") {
      return Response.json({ error: "Invalid sigil data" }, { status: 400 });
    }
    if (!body.sigil_data.startsWith("data:image/png;base64,")) {
      return Response.json({ error: "Sigil must be a PNG data URL" }, { status: 400 });
    }
    if (body.sigil_data.length > MAX_SIGIL_BYTES) {
      return Response.json({ error: "Sigil data too large" }, { status: 400 });
    }
  }

  await query(
    "UPDATE users SET sigil_data = $1 WHERE id = $2",
    [body.sigil_data, session.userId]
  );

  return Response.json({ ok: true });
}
