import { NextRequest } from "next/server";
import { query, queryOne, withTransaction } from "@/lib/db";
import { getSession } from "@/lib/session";
import { TAROT_DECK } from "@/lib/cards";
import { stockMeaning, toPersonalMeaning, type MeaningRow } from "@/lib/personal-meanings";
import { jsonBody } from "@/lib/own-http";

const FIELDS = {
  uprightKeywords: "upright_keywords",
  reversedKeywords: "reversed_keywords",
  uprightDescription: "upright_description",
  reversedDescription: "reversed_description",
} as const;

type FieldName = keyof typeof FIELDS;

async function loadRow(userId: number, cardId: string) {
  return queryOne<MeaningRow & { updated_at: string }>(
    "SELECT upright_keywords, reversed_keywords, upright_description, reversed_description, updated_at FROM card_customizations WHERE user_id = $1 AND card_id = $2",
    [userId, cardId]
  );
}

// The user's own meaning and the built-in text are returned separately; the page decides when to show each.
export async function GET(_req: NextRequest, ctx: RouteContext<"/api/cards/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const card = TAROT_DECK.find((c) => c.id === id);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const row = await loadRow(session.userId, id);
  const revisions = await queryOne<{ c: string }>(
    "SELECT COUNT(*) AS c FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2",
    [session.userId, id]
  );

  return Response.json({
    id: card.id,
    name: card.name,
    suit: card.suit,
    fileName: card.fileName,
    personal: toPersonalMeaning(card, row),
    personalUpdatedAt: row?.updated_at ?? null,
    stock: stockMeaning(card),
    revisionCount: Number(revisions?.c ?? 0),
  });
}

// A field left out of the body is unchanged; an empty string or null clears it. Every save adds a revision.
export async function PATCH(req: NextRequest, ctx: RouteContext<"/api/cards/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const card = TAROT_DECK.find((c) => c.id === id);
  if (!card) return Response.json({ error: "Not found" }, { status: 404 });

  const sent = await jsonBody(req);
  if (sent instanceof Response) return sent;
  const body = sent as Partial<Record<FieldName, string | null>>;
  const current = toPersonalMeaning(card, await loadRow(userId, id));

  const next = {} as Record<FieldName, string | null>;
  for (const field of Object.keys(FIELDS) as FieldName[]) {
    const value = body[field];
    next[field] = value === undefined ? current?.[field] ?? null : value?.trim() || null;
  }
  const values = (Object.keys(FIELDS) as FieldName[]).map((f) => next[f]);

  await withTransaction(async (client) => {
    if (values.every((v) => v === null)) {
      await client.query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [userId, id]);
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
      [userId, id, ...values]
    );
    const changed = (Object.keys(FIELDS) as FieldName[]).some((f) => next[f] !== (current?.[f] ?? null));
    if (changed) {
      await client.query(
        `INSERT INTO card_meaning_revisions (user_id, card_id, upright_keywords, reversed_keywords, upright_description, reversed_description)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, id, ...values]
      );
    }
  });

  return Response.json({ ok: true, personal: values.every((v) => v === null) ? null : next });
}

// Removes the user's current meaning for this card. Add ?history=1 to remove every earlier version too.
export async function DELETE(req: NextRequest, ctx: RouteContext<"/api/cards/[id]">) {
  const { id } = await ctx.params;
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  await query("DELETE FROM card_customizations WHERE user_id = $1 AND card_id = $2", [session.userId, id]);
  if (new URL(req.url).searchParams.get("history") === "1") {
    await query("DELETE FROM card_meaning_revisions WHERE user_id = $1 AND card_id = $2", [session.userId, id]);
  }
  return new Response(null, { status: 204 });
}
