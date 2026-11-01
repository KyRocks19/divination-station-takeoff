import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getStave } from "@/lib/ogham";

// A person's own meaning for a stave is kept in card_customizations, with every version in card_meaning_revisions,
// under the stave's id (for example 'stave-fehu'). It works like a tarot card's meaning, without the tarot stock text.
// Earlier versions are listed and deleted through /api/cards/[id]/revisions, which works for any id.

const FIELDS = {
  uprightKeywords: "upright_keywords",
  reversedKeywords: "reversed_keywords",
  uprightDescription: "upright_description",
  reversedDescription: "reversed_description",
} as const;

type FieldName = keyof typeof FIELDS;
const NAMES = Object.keys(FIELDS) as FieldName[];

interface Row {
  upright_keywords: string | null;
  reversed_keywords: string | null;
  upright_description: string | null;
  reversed_description: string | null;
  updated_at: string;
}

async function loadRow(userId: number, staveId: string) {
  return queryOne<Row>(
    "SELECT upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at FROM card_customizations WHERE user_id = $1 AND card_id = $2",
    [userId, staveId]
  );
}

function toFields(row: Row | null): Record<FieldName, string | null> | null {
  if (!row) return null;
  const fields = {} as Record<FieldName, string | null>;
  for (const f of NAMES) fields[f] = row[FIELDS[f]]?.trim() || null;
  return Object.values(fields).some(Boolean) ? fields : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ staveId: string }> }) {
  const { staveId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const stave = getStave(staveId);
  if (!stave) return Response.json({ error: "Not found" }, { status: 404 });

  const row = await loadRow(session.userId, staveId);
  const revisions = await queryOne<{ c: string }>(
    "SELECT COUNT(*) AS c FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2",
    [session.userId, staveId]
  );
  return Response.json({
    id: stave.id,
    name: stave.name,
    personal: toFields(row),
    personalUpdatedAt: row?.updated_at ?? null,
    // The tradition's text is not sent here; the page shows it from the stave set when the person presses the button.
    stock: { uprightKeywords: null, reversedKeywords: null, uprightDescription: null, reversedDescription: null },
    revisionCount: Number(revisions?.c ?? 0),
  });
}

// A field left out of the body is unchanged; an empty string or null clears it. Every change adds a version.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ staveId: string }> }) {
  const { staveId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;
  if (!getStave(staveId)) return Response.json({ error: "Not found" }, { status: 404 });

  const body = (await req.json().catch(() => null)) as Partial<Record<FieldName, string | null>> | null;
  const current = toFields(await loadRow(userId, staveId));

  const next = {} as Record<FieldName, string | null>;
  for (const field of NAMES) {
    const value = body?.[field];
    next[field] = value === undefined ? current?.[field] ?? null : typeof value === "string" ? value.trim() || null : null;
  }
  const values = NAMES.map((f) => next[f]);

  await withTransaction(async (client) => {
    if (values.every((v) => v === null)) {
      await client.query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [userId, staveId]);
      return;
    }
    await client.query(
      `INSERT INTO card_customizations (user_id, card_id, upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, card_id) DO UPDATE SET
         upright_keywords     = EXCLUDED.upright_keywords,
         reversed_keywords    = EXCLUDED.reversed_keywords,
         upright_description  = EXCLUDED.upright_description,
         reversed_description = EXCLUDED.reversed_description,
         updated_at           = NOW()`,
      [userId, staveId, ...values]
    );
    if (NAMES.some((f) => next[f] !== (current?.[f] ?? null))) {
      await client.query(
        `INSERT INTO card_meaning_revisions (user_id, card_id, upright_keywords, reversed_keywords, upright_description, reversed_description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, staveId, ...values]
      );
    }
  });

  return Response.json({ ok: true, personal: values.every((v) => v === null) ? null : next });
}

// Removes the person's current meaning for this stave. Earlier versions are kept unless ?history=1 is added.
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ staveId: string }> }) {
  const { staveId } = await params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!getStave(staveId)) return Response.json({ error: "Not found" }, { status: 404 });

  await query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [session.userId, staveId]);
  if (new URL(req.url).searchParams.get("history") === "1") {
    await query("DELETE FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2", [session.userId, staveId]);
  }
  return new Response(null, { status: 204 });
}
