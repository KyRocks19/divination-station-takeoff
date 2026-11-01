import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { deleteRecent, getRecent, recordRecent, setRemember } from "@/lib/recent-searches";

// The header search window's recent searches (migration 071). Off until the person turns them on.
//   GET     -> { on, items }
//   PUT     { on: true | false } -> turns remembering on or off (off also deletes the saved searches)
//   POST    { q } -> keeps the words of a search the person acted on (nothing happens while remembering is off)
//   DELETE  ?id=N -> deletes one saved search; with no id, all of them
// Each answer is the person's own, so none is cached. Every handler checks who is asking for itself.
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await getRecent(session.userId), { headers: NO_STORE });
}

export async function PUT(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (typeof body?.on !== "boolean") return Response.json({ error: "on must be true or false" }, { status: 400 });
  await setRemember(session.userId, body.on);
  return Response.json(await getRecent(session.userId), { headers: NO_STORE });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => null);
  await recordRecent(session.userId, body?.q);
  return Response.json({ ok: true }, { headers: NO_STORE });
}

export async function DELETE(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const raw = new URL(req.url).searchParams.get("id");
  if (raw === null) {
    await deleteRecent(session.userId);
  } else {
    const id = Number(raw);
    if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not a saved search" }, { status: 400 });
    await deleteRecent(session.userId, id);
  }
  return Response.json(await getRecent(session.userId), { headers: NO_STORE });
}
