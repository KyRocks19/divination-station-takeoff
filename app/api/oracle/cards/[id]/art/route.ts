import { NextRequest } from "next/server";
import { PICTURE_CSP } from "@/lib/csp";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { cleanMadeWith } from "@/lib/art-maker";
import { maxPictureBytes, parseImageDataUrl } from "@/lib/oracle-gallery";
import { ArtBudgetError, DISK_REQUIRED_MESSAGE, artDir, ensureRoom, bytesOfRow, deleteArt, diskRequiredButMissing, placeBytes, readArt, thumbnailOf, writeArt } from "@/lib/art-store";
import { attachmentHeader, cleanAlt, cleanDrawing, downloadName, drawingToSvg, type Drawing } from "@/lib/oracle-art";
import { idParam } from "@/lib/own-http";

type Ctx = { params: Promise<{ id: string }> };

const OFFLINE = "This picture is stored on the owner's computer, which is not reachable right now.";

async function ownedCard(cardId: number, userId: number) {
  return queryOne<{ id: number; form: string }>(
    `SELECT c.id, d.form FROM oracle_cards c JOIN oracle_decks d ON d.id = c.deck_id
     WHERE c.id = $1 AND c.user_id = $2`,
    [cardId, userId]
  );
}

/** Where a new picture goes, or the answer to send when the person has used their share of the database. */
async function placeOrRefuse(userId: number, bytes: Buffer, mime: string) {
  try {
    await ensureRoom(userId, bytes.length);
    return await placeBytes(userId, bytes, mime);
  } catch (err) {
    if (err instanceof ArtBudgetError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
}

/** The key of the file behind an item's current picture, if it has one. */
async function currentKey(cardId: number, userId: number): Promise<string | null> {
  const row = await queryOne<{ file_key: string | null }>(
    "SELECT file_key FROM oracle_card_art WHERE card_id = $1 AND user_id = $2",
    [cardId, userId]
  );
  return row?.file_key ?? null;
}

// The picture itself, for an <img>. A drawing is drawn as an SVG from its checked strokes; an upload is sent back
// as the type its first bytes proved it to be. Never cached by shared caches: it is the person's own.
export async function GET(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const art = await queryOne<{ kind: string; mime: string | null; data: Buffer | null; strokes: string | null; file_key: string | null; form: string }>(
    `SELECT a.kind, a.mime, a.data, a.strokes, a.file_key, d.form
     FROM oracle_card_art a
     JOIN oracle_cards c ON c.id = a.card_id
     JOIN oracle_decks d ON d.id = c.deck_id
     WHERE a.card_id = $1 AND a.user_id = $2`,
    [toId(id), session.userId]
  );
  if (!art) return Response.json({ error: "Not found" }, { status: 404 });

  // ?download=1: the same picture as a file to save, under a name made up here (lib/oracle-art.ts downloadName).
  const download = req.nextUrl.searchParams.get("download") === "1";
  const headers = {
    "Cache-Control": "private, max-age=31536000, immutable",
    "X-Content-Type-Options": "nosniff",
    "Content-Security-Policy": PICTURE_CSP,
  };
  if (art.kind === "drawing") {
    let text = art.strokes;
    if (!text && art.file_key) text = (await readArt(art.file_key, session.userId))?.toString("utf8") ?? null;
    if (!text) return Response.json({ error: OFFLINE }, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(drawingToSvg(JSON.parse(text) as Drawing, art.form), {
      headers: { ...headers, "Content-Type": "image/svg+xml; charset=utf-8", ...(download ? { "Content-Disposition": attachmentHeader(downloadName("item", toId(id), "image/svg+xml")) } : {}) },
    });
  }
  const bytes = await bytesOfRow(art, session.userId);
  if (!bytes) return Response.json({ error: OFFLINE }, { status: 404, headers: { "Cache-Control": "no-store" } });
  // ?s=thumb: a small preview for lists, so a page of large pictures stays light.
  if (req.nextUrl.searchParams.get("s") === "thumb") {
    const thumb = await thumbnailOf(bytes, art.file_key, session.userId);
    if (thumb) return new Response(new Uint8Array(thumb), { headers: { ...headers, "Content-Type": "image/webp" } });
  }
  const mime = art.mime ?? "application/octet-stream";
  return new Response(new Uint8Array(bytes), {
    headers: { ...headers, "Content-Type": mime, ...(download ? { "Content-Disposition": attachmentHeader(downloadName("item", toId(id), mime)) } : {}) },
  });
}

// Saves the item's picture, replacing any it had. Body: { kind: "drawing", drawing: { background, strokes }, alt }
// or { kind: "upload", image: "data:image/...;base64,...", alt, made_with? }, or { kind: "gallery", gallery_id, alt? }.
// Only { alt } changes the description alone. With ART_DIR set the picture is written to a file and the row keeps its key.
export async function PUT(request: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  const card = await ownedCard(toId(id), userId);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request could not be read" }, { status: 400 });
  }
  const alt = cleanAlt(body?.alt);
  if ((body?.kind === "drawing" || body?.kind === "upload" || body?.kind === "gallery") && diskRequiredButMissing()) {
    return Response.json({ error: DISK_REQUIRED_MESSAGE }, { status: 503 });
  }

  // Saves one picture row, writing the file first and removing it again if the row cannot be saved. The file of the
  // picture that was there before is removed only after the new row is in.
  async function save(
    kind: "drawing" | "upload",
    mime: string | null,
    place: { data: Buffer | null; file_key: string | null },
    strokes: string | null,
    description: string | null,
    madeWith: string | null
  ): Promise<Response> {
    const before = await currentKey(card!.id, userId);
    try {
      await queryOne(
        `INSERT INTO oracle_card_art (card_id, user_id, kind, mime, data, strokes, alt, made_with, file_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (card_id) DO UPDATE
           SET kind = EXCLUDED.kind, mime = EXCLUDED.mime, data = EXCLUDED.data, strokes = EXCLUDED.strokes,
               alt = EXCLUDED.alt, made_with = EXCLUDED.made_with, file_key = EXCLUDED.file_key, updated_at = NOW()`,
        [card!.id, userId, kind, mime, place.data, strokes, description, madeWith, place.file_key]
      );
    } catch (err) {
      await deleteArt([place.file_key], userId);
      throw err;
    }
    if (before && before !== place.file_key) await deleteArt([before], userId);
    return Response.json({ ok: true }, { status: 200 });
  }

  if (body?.kind === "drawing") {
    const checked = cleanDrawing(body.drawing, card.form);
    if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });
    const text = JSON.stringify(checked.drawing);
    const onDisk = artDir() !== null;
    const key = onDisk ? await writeArt(userId, Buffer.from(text, "utf8"), "json") : null;
    return save("drawing", null, { data: null, file_key: key }, onDisk ? null : text, alt, null);
  }

  if (body?.kind === "upload") {
    const parsed = parseImageDataUrl(body.image, maxPictureBytes());
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
    const place = await placeOrRefuse(userId, parsed.bytes, parsed.mime);
    if (place instanceof Response) return place;
    return save("upload", parsed.mime, place, null, alt, cleanMadeWith(body.made_with));
  }

  // A picture from the person's own gallery, copied onto the item. The gallery keeps its own copy (and its own file).
  if (body?.kind === "gallery") {
    const g = await queryOne<{ mime: string; data: Buffer | null; file_key: string | null; alt: string | null; made_with: string | null }>(
      "SELECT mime, data, file_key, alt, made_with FROM oracle_gallery WHERE id = $1 AND user_id = $2",
      [toId(body.gallery_id), userId]
    );
    if (!g) return Response.json({ error: "That picture is not in your gallery" }, { status: 404 });
    const bytes = await bytesOfRow(g, userId);
    if (!bytes) return Response.json({ error: OFFLINE }, { status: 404 });
    const place = await placeOrRefuse(userId, bytes, g.mime);
    if (place instanceof Response) return place;
    return save("upload", g.mime, place, null, alt ?? g.alt, g.made_with);
  }

  // Only the description and the "made with" note: the picture stays as it is. Sending made_with as null removes the note.
  if (body && body.kind === undefined && ("alt" in body || "made_with" in body)) {
    const updated = await queryOne(
      `UPDATE oracle_card_art
       SET alt = CASE WHEN $4 THEN $1 ELSE alt END,
           made_with = CASE WHEN $5 THEN NULL ELSE made_with END
       WHERE card_id = $2 AND user_id = $3 RETURNING card_id`,
      [alt, card.id, userId, "alt" in body, "made_with" in body && body.made_with === null]
    );
    if (!updated) return Response.json({ error: "This item has no picture yet" }, { status: 404 });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "kind must be drawing, upload, or gallery" }, { status: 400 });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const row = await queryOne<{ file_key: string | null }>(
    "DELETE FROM oracle_card_art WHERE card_id = $1 AND user_id = $2 RETURNING file_key",
    [toId(id), session.userId]
  );
  await deleteArt([row?.file_key], session.userId);
  return new Response(null, { status: 204 });
}
