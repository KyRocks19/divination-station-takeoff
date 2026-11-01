import { query, queryOne } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getCardById } from "@/lib/cards";
import { conceptQuery, showsSensitive } from "@/lib/concept-visibility";
import { getOwnDescription } from "@/lib/concept-descriptions";
import { idParam } from "@/lib/own-http";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const conceptId = parseInt(id, 10);
  if (isNaN(conceptId)) return Response.json({ error: "Invalid id" }, { status: 400 });

  // A concept held back from this person (hidden, or sensitive while they have not turned it on) is not found, the same as one that does not exist.
  const show = await showsSensitive(session.userId);
  const [concept] = await conceptQuery<any>(
    "SELECT c.id, c.name, c.display_name, c.description, c.description_generated_at FROM concepts c WHERE c.id = $1 AND {visible}",
    [conceptId],
    show
  );
  if (!concept) return Response.json({ error: "Not found" }, { status: 404 });

  // Cards that include this concept, with polarity flag
  const cardRows = await query(
    "SELECT card_id, reversed FROM card_concepts WHERE concept_id = $1 ORDER BY card_id",
    [conceptId]
  ) as any[];
  const cards = cardRows
    .map((r: any) => {
      const card = getCardById(r.card_id);
      if (!card) return null;
      return { ...card, reversed: r.reversed as boolean };
    })
    .filter(Boolean);

  // Related concepts: share at least one card with this concept, ranked by overlap
  const related = await conceptQuery<any>(
    `SELECT c.id, c.name, c.display_name, COUNT(DISTINCT cc1.card_id)::int AS overlap
     FROM card_concepts cc1
     JOIN card_concepts cc2 ON cc2.card_id = cc1.card_id AND cc2.concept_id = $1
     JOIN concepts c ON c.id = cc1.concept_id
     WHERE cc1.concept_id != $1 AND {visible}
     GROUP BY c.id
     ORDER BY overlap DESC, c.display_name ASC
     LIMIT 20`,
    [conceptId],
    show
  );

  // User's note
  const note = await queryOne(
    "SELECT content FROM concept_notes WHERE concept_id = $1 AND user_id = $2",
    [conceptId, session.userId]
  ) as any;

  return Response.json({
    ...concept,
    cards,
    related,
    note: note?.content ?? null,
    // What Hiero wrote for this person alone; the shared `description` above is older text, if any.
    own_description: await getOwnDescription(session.userId, conceptId),
  });
}
