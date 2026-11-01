import { NextRequest } from "next/server";
import { queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { cleanText, listFieldNames } from "@/lib/oracle";

// The field names the person has used on their cards, most used first, each with how many cards hold it.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listFieldNames(session.userId));
}

/** The longest a field name can be when it is renamed. */
const MAX_FIELD_NAME = 100;

// Renames one field name on every item the person has, keeping what they wrote in each. Names that differ only in
// capital letters or spaces around them are the same name. Body: `name` (which one) and `new_name`. Renaming to a
// name other items already have joins the two; it is refused only when one item would end up holding the new name
// twice. Returns how many fields and items changed.
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const body = await request.json().catch(() => null);
  const from = cleanText(body?.name);
  const to = cleanText(body?.new_name);
  if (!from || !to) return Response.json({ error: "name and new_name are required" }, { status: 400 });
  if (to.length > MAX_FIELD_NAME) return Response.json({ error: `A field name can be up to ${MAX_FIELD_NAME} characters.` }, { status: 400 });

  const sameName = from.toLowerCase() === to.toLowerCase();
  if (!sameName) {
    // Items that already hold both names would end up with the same name twice.
    const clash = await queryOne<{ cards: number }>(
      `SELECT COUNT(DISTINCT a.card_id)::int AS cards
       FROM oracle_card_fields a
       JOIN oracle_card_fields b ON b.card_id = a.card_id AND b.user_id = a.user_id
       WHERE a.user_id = $1 AND LOWER(BTRIM(a.name)) = LOWER(BTRIM($2)) AND LOWER(BTRIM(b.name)) = LOWER(BTRIM($3))`,
      [userId, from, to]
    );
    if (clash && clash.cards > 0) {
      return Response.json(
        {
          error: `${clash.cards === 1 ? "1 item has" : `${clash.cards} items have`} both "${from}" and "${to}". Remove one of them from ${
            clash.cards === 1 ? "that item" : "those items"
          } first, so no item holds the same name twice.`,
        },
        { status: 409 }
      );
    }
  }

  const changed = await queryOne<{ fields: number; cards: number }>(
    `WITH renamed AS (
       UPDATE oracle_card_fields SET name = $2, updated_at = NOW()
       WHERE user_id = $1 AND LOWER(BTRIM(name)) = LOWER(BTRIM($3))
       RETURNING card_id
     )
     SELECT COUNT(*)::int AS fields, COUNT(DISTINCT card_id)::int AS cards FROM renamed`,
    [userId, to, from]
  );
  return Response.json(changed ?? { fields: 0, cards: 0 });
}

// Removes one field name from every card the person has, with what they wrote in it. Names that differ only in
// capital letters or spaces around them are the same name. The cards themselves are not touched. `?name=` says
// which name; it is required, so a request with no name removes nothing.
export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const name = cleanText(request.nextUrl.searchParams.get("name"));
  if (!name) return Response.json({ error: "name is required" }, { status: 400 });

  const removed = await queryOne<{ fields: number; cards: number }>(
    `WITH gone AS (
       DELETE FROM oracle_card_fields
       WHERE user_id = $1 AND LOWER(BTRIM(name)) = LOWER(BTRIM($2))
       RETURNING card_id
     )
     SELECT COUNT(*)::int AS fields, COUNT(DISTINCT card_id)::int AS cards FROM gone`,
    [session.userId, name]
  );
  return Response.json(removed ?? { fields: 0, cards: 0 });
}
