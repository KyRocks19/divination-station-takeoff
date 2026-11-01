import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { logAdminAction } from "@/lib/admin-log";
import { cleanSourceNote } from "@/lib/source-notes-core";
import { setSourceNote } from "@/lib/source-notes";

// PUT saves an admin's note on a source, shown to everyone on this copy. Outside /api/admin so a local copy keeps it. Body: { sourceId, note }; an empty note removes it.
// The sources pages read the notes on the server, so there is no GET.

export async function PUT(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Only an admin can write notes on the sources" }, { status: 403 });

  const body = await request.json().catch(() => null);
  const cleaned = cleanSourceNote(body);
  if (!cleaned.ok) return Response.json({ error: cleaned.error }, { status: 400 });

  await setSourceNote(cleaned.sourceId, cleaned.note, session.userId);

  await logAdminAction(session, "source_note_changed", { detail: `${cleaned.sourceId}${cleaned.note ? "" : " (removed)"}` });
  return Response.json({ ok: true });
}
