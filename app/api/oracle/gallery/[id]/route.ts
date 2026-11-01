import { NextRequest } from "next/server";
import { PICTURE_CSP } from "@/lib/csp";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { attachmentHeader, cleanAlt, downloadName } from "@/lib/oracle-art";
import { bytesOfRow, deleteArt, thumbnailOf } from "@/lib/art-store";
import { cleanTags } from "@/lib/gallery-tags-core";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

// The picture itself, for an <img>. Sent as the type its first bytes proved it to be, and locked down the same way as
// item pictures. Private to its owner. When the file lives on the owner's computer and that computer cannot be reached,
// the answer is a plain 404 that is not cached.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const row = await queryOne<{ mime: string; data: Buffer | null; file_key: string | null }>(
    "SELECT mime, data, file_key FROM oracle_gallery WHERE id = $1 AND user_id = $2",
    [toId(id), session.userId]
  );
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const bytes = await bytesOfRow(row, session.userId);
  if (!bytes) {
    return Response.json(
      { error: "This picture is stored on the owner's computer, which is not reachable right now." },
      { status: 404, headers: { "Cache-Control": "no-store" } }
    );
  }
  const headers = {
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": PICTURE_CSP,
  };
  // ?s=thumb: a small preview for the gallery grid and pickers.
  if (req.nextUrl.searchParams.get("s") === "thumb") {
    const thumb = await thumbnailOf(bytes, row.file_key, session.userId);
    if (thumb) return new Response(new Uint8Array(thumb), { headers: { ...headers, "Content-Type": "image/webp" } });
  }
  // ?download=1: the same picture as a file to save, under a name made up here.
  const download = req.nextUrl.searchParams.get("download") === "1";
  return new Response(new Uint8Array(bytes), {
    headers: {
      ...headers,
      "Content-Type": row.mime,
      ...(download ? { "Content-Disposition": attachmentHeader(downloadName("gallery", toId(id), row.mime)) } : {}),
    },
  });
}

// Changes the description and/or the tags. Body: { alt } and/or { tags } (a list, or text with the tags separated by commas). The picture itself is
// never changed here; delete it and add another.
export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || !("alt" in body || "tags" in body)) return Response.json({ error: "alt or tags is required" }, { status: 400 });
  const owned = await queryOne("SELECT id FROM oracle_gallery WHERE id = $1 AND user_id = $2", [toId(id), session.userId]);
  if (!owned) return Response.json({ error: "Not found" }, { status: 404 });
  if ("alt" in body) {
    await queryOne("UPDATE oracle_gallery SET alt = $1 WHERE id = $2 AND user_id = $3 RETURNING id", [cleanAlt(body.alt), toId(id), session.userId]);
  }
  if ("tags" in body) {
    const tags = cleanTags(body.tags);
    await queryOne("UPDATE oracle_gallery SET tags = $1::text[] WHERE id = $2 AND user_id = $3 RETURNING id", [tags, toId(id), session.userId]);
    return Response.json({ ok: true, tags });
  }
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const row = await queryOne<{ file_key: string | null }>(
    "DELETE FROM oracle_gallery WHERE id = $1 AND user_id = $2 RETURNING file_key",
    [toId(id), session.userId]
  );
  await deleteArt([row?.file_key], session.userId);
  return new Response(null, { status: 204 });
}
