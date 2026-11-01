import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getArchetype } from "@/lib/archetypes-data";
import { loadSymbolStore } from "@/lib/symbol-links";
import { logAdminAction } from "@/lib/admin-log";
import { symbolLabel } from "@/lib/piece-labels";
import { cleanStockLinks, isStockPiece } from "@/lib/symbol-edit-core";
import { replaceStockLinks } from "@/lib/symbol-edit";
import { loadHidden } from "@/lib/hidden-links";
import { hiddenKey } from "@/lib/hidden-links-core";
import { SYMBOL_ID_SHAPE as ID } from "@/lib/symbol-ids";

// The shared archetype links of one piece of a ritual set (a rune, an ogham letter, ...), with what each link was drawn
// from and the piece's note. The links are the same for everyone (stock data, like the concepts), so any signed-in
// person may read them. `recorded` is false when the database has nothing for the piece: the caller then shows the
// older mapping it already has. Each link says whether the person asking has hidden it for themselves.
//
// PUT replaces a stock piece's links and note. The links are shared by every account, so only an admin may change them,
// and each change is written to the admin log. Body: { links: [{ slug, aspect, basis }], note } (the first link is the
// piece's primary archetype).


export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ID.test(id)) return Response.json({ error: "Not a piece id" }, { status: 400 });

  const [store, hidden] = await Promise.all([loadSymbolStore(), loadHidden(session.userId)]);
  const links = (store.links.get(id) ?? []).flatMap((l) => {
    const a = getArchetype(l.slug);
    // `hidden` is this person's own choice (migration 073); it changes nothing for anyone else.
    return a ? [{ slug: l.slug, name: a.name, aspect: l.aspect, basis: l.basis, primary: l.primary, hidden: hidden.has(hiddenKey(id, l.slug)) }] : [];
  });
  return Response.json({ recorded: store.recorded.has(id), links, note: store.notes.get(id) ?? null });
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!session.isAdmin) return Response.json({ error: "Only an admin can change the shared archetypes" }, { status: 403 });
  const { id } = await params;
  if (!ID.test(id) || !isStockPiece(id)) return Response.json({ error: "Not a piece whose archetypes can be changed here" }, { status: 404 });

  const body = await request.json().catch(() => null);
  const cleaned = cleanStockLinks(body);
  if (!cleaned.ok) return Response.json({ error: cleaned.error }, { status: 400 });

  const result = await replaceStockLinks(id, cleaned.links, cleaned.note);
  if (!result.ok) return Response.json({ error: "One of the archetypes is missing from the database" }, { status: 409 });
  await logAdminAction(session, "symbol_links_changed", {
    targetName: symbolLabel(id)?.name ?? id,
    detail: `${result.before} to ${cleaned.links.length} archetypes`,
  });
  return Response.json({ ok: true, links: cleaned.links.length });
}
