import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { MAX_GALLERY_ITEMS, MAX_PROMPT_LENGTH, cleanAlt } from "@/lib/oracle-art";
import { listGallery, maxPictureBytes, parseImageDataUrl } from "@/lib/oracle-gallery";
import { cleanMadeWith } from "@/lib/art-maker";
import { cleanTags } from "@/lib/gallery-tags-core";
import { ArtBudgetError, DISK_REQUIRED_MESSAGE, bytesOfRow, ensureRoom, deleteArt, diskRequiredButMissing, placeBytes } from "@/lib/art-store";

// The person's gallery: pictures kept on the site that are not on any card. Everything is scoped to the signed-in person.
// With ART_DIR set the pictures are files on the disk of the computer that runs the app; otherwise they stay in the database.

export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json({ max: MAX_GALLERY_ITEMS, items: await listGallery(session.userId) });
}

// Adds a picture. Body: { image: "data:image/...;base64,...", alt?, prompt?, made_with? }
// or { from_card: <id> } to copy an uploaded picture from one of the person's own items.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  let body: any;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "The request could not be read" }, { status: 400 });
  }

  if (diskRequiredButMissing()) return Response.json({ error: DISK_REQUIRED_MESSAGE }, { status: 503 });

  let mime: string;
  let bytes: Buffer;
  let alt = cleanAlt(body?.alt);
  let prompt: string | null = typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim().slice(0, MAX_PROMPT_LENGTH) : null;
  let madeWith = cleanMadeWith(body?.made_with);
  const tags = cleanTags(body?.tags);

  if (body?.from_card !== undefined) {
    const art = await queryOne<{ kind: string; mime: string | null; data: Buffer | null; file_key: string | null; alt: string | null; made_with: string | null }>(
      "SELECT kind, mime, data, file_key, alt, made_with FROM oracle_card_art WHERE card_id = $1 AND user_id = $2",
      [toId(body.from_card), userId]
    );
    if (!art) return Response.json({ error: "This item has no picture" }, { status: 404 });
    if (art.kind !== "upload" || !art.mime) {
      return Response.json({ error: "Only an uploaded or made picture can be copied to the gallery by the server. A drawing is kept in the gallery from its item's page, which sends it as a picture." }, { status: 400 });
    }
    const copied = await bytesOfRow(art, userId);
    if (!copied) return Response.json({ error: "This picture is stored on the owner's computer, which is not reachable right now." }, { status: 404 });
    mime = art.mime;
    bytes = copied;
    alt = alt ?? art.alt;
    madeWith = art.made_with;
    prompt = null;
  } else {
    const parsed = parseImageDataUrl(body?.image, maxPictureBytes());
    if (!parsed.ok) return Response.json({ error: parsed.error }, { status: parsed.status });
    mime = parsed.mime;
    bytes = parsed.bytes;
  }

  let place: Awaited<ReturnType<typeof placeBytes>>;
  try {
    await ensureRoom(userId, bytes.length);
    place = await placeBytes(userId, bytes, mime);
  } catch (err) {
    if (err instanceof ArtBudgetError) return Response.json({ error: err.message }, { status: err.status });
    throw err;
  }
  // One statement checks the limit and adds the row, so two requests at once cannot go over it.
  let row: { id: number } | null;
  try {
    row = await queryOne<{ id: number }>(
      `INSERT INTO oracle_gallery (user_id, mime, data, file_key, alt, prompt, made_with, tags)
       SELECT $1::int, $2, $3, $4, $5, $6, $7, $9::text[]
       WHERE (SELECT COUNT(*) FROM oracle_gallery WHERE user_id = $1::int) < $8
       RETURNING id`,
      [userId, mime, place.data, place.file_key, alt, prompt, madeWith, MAX_GALLERY_ITEMS, tags]
    );
  } catch (err) {
    await deleteArt([place.file_key], userId);
    throw err;
  }
  if (!row) {
    await deleteArt([place.file_key], userId);
    return Response.json(
      { error: `The gallery holds ${MAX_GALLERY_ITEMS} pictures. Delete one to make room.` },
      { status: 409 }
    );
  }
  return Response.json({ id: row.id }, { status: 201 });
}
