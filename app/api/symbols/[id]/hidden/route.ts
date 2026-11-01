import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { commonMeaningFor } from "@/lib/common-meanings-data";
import { linksOf } from "@/lib/symbol-links-core";
import { loadSymbolStore } from "@/lib/symbol-links";
import { SYMBOL_ID_SHAPE as ID, isKnownSymbolId } from "@/lib/symbol-ids";
import { setHidden } from "@/lib/hidden-links";

// A person hiding one shared archetype link of a piece for themselves, or showing it again (migration 073, open item R4):
// PUT /api/symbols/rune-fehu/hidden with { "slug": "wealth-resources", "hidden": true }. It changes nothing for anyone else and
// nothing in the shared data. Only a link the piece really has can be hidden. The answer holds only the person's own choice.

const NO_STORE = { "Cache-Control": "private, no-store" };

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  if (!ID.test(id) || !isKnownSymbolId(id)) return Response.json({ error: "Not a piece" }, { status: 404 });

  const body = await request.json().catch(() => null);
  if (typeof body?.slug !== "string" || typeof body?.hidden !== "boolean") {
    return Response.json({ error: "slug and hidden (true or false) are needed" }, { status: 400 });
  }
  if (body.hidden) {
    const store = await loadSymbolStore();
    const has = linksOf(store, id, commonMeaningFor(id)?.archetypes ?? []).some((l) => l.slug === body.slug);
    if (!has) return Response.json({ error: "This piece has no such link" }, { status: 404 });
  }

  const result = await setHidden(session.userId, id, body.slug, body.hidden);
  if (result === "no-archetype") return Response.json({ error: "Not an archetype" }, { status: 404 });
  if (result === "limit") return Response.json({ error: "You have hidden as many links as can be kept" }, { status: 409 });
  return Response.json({ ok: true, hidden: body.hidden }, { headers: NO_STORE });
}
