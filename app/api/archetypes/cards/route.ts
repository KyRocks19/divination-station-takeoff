import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { logAdminAction } from "@/lib/admin-log";
import { getCardById } from "@/lib/cards";
import { cardBoard, isCard, moveCardConcepts } from "@/lib/card-concept-edit";
import { cleanCardMove, spotLabel } from "@/lib/card-concept-edit-core";

// The "By card" board on /archetypes/review: one card's concepts, upright and reversed, and moving or copying concepts
// from one card to another. Concepts and their card links are shared by every account, so only an admin may use it,
// and each change is written to the admin log.

/** GET ?card=major-16 */
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const card = request.nextUrl.searchParams.get("card") ?? "";
  if (!isCard(card)) return Response.json({ error: "Unknown card" }, { status: 400 });
  return Response.json(await cardBoard(card));
}

/** PATCH { ids: number[], from: { card, orientation }, to: { card, orientation }, copy?: boolean } */
export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const cleaned = cleanCardMove(await request.json().catch(() => null), isCard);
  if (!cleaned.ok) return Response.json({ error: cleaned.error }, { status: 400 });
  const { move } = cleaned;

  const moved = await moveCardConcepts(move);
  if (moved > 0) {
    const name = (id: string) => getCardById(id)?.name ?? id;
    await logAdminAction(session, "card_concepts_changed", {
      targetName: name(move.from.card),
      detail: `${move.copy ? "copied" : "moved"} ${moved} concept${moved === 1 ? "" : "s"} from ${spotLabel(name(move.from.card), move.from.orientation)} to ${spotLabel(name(move.to.card), move.to.orientation)}`,
    });
  }
  return Response.json({ moved });
}
