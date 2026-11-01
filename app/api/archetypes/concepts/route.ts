import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { ACTIONS, ASPECTS, applyChange, conceptRowsFor, listConcepts } from "@/lib/archetype-edit";

// Reviewing and changing which archetypes the tarot concepts sit under. Concepts are shared by every account, so
// only an admin can change them (the same rule as the account list).

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return null;
  return session;
}

/** GET ?archetype=slug|none &q=text &aspect=light|shadow|neutral &offset=0 &limit=50 */
export async function GET(request: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const sp = request.nextUrl.searchParams;
  const aspect = sp.get("aspect") ?? "";
  if (aspect && !ASPECTS.includes(aspect)) return Response.json({ error: "Unknown aspect" }, { status: 400 });
  return Response.json(
    await listConcepts({
      archetype: sp.get("archetype") ?? "",
      q: (sp.get("q") ?? "").trim(),
      aspect,
      offset: Math.max(0, Number(sp.get("offset")) || 0),
      limit: Math.min(100, Math.max(1, Number(sp.get("limit")) || 50)),
    })
  );
}

/**
 * PATCH, one of:
 *   { action: "move", ids: number[], to: slug }   the concept's first archetype becomes `to`; the old first one is removed
 *   { action: "aspect", ids: number[], aspect }   which side of its archetypes the concept names
 *   { action: "add", id, slug }                   one more archetype (the first, if it had none)
 *   { action: "remove", id, slug }                takes one off; if it was the first, the next one takes its place
 *   { action: "primary", id, slug }               makes an archetype the concept already has its first one
 *   { action: "realm", ids: number[], realm }      the concept's own realm (one of the twelve); null takes its first archetype's
 */
export async function PATCH(request: NextRequest) {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null);
  if (!body || !ACTIONS.includes(body.action)) return Response.json({ error: "Unknown action" }, { status: 400 });
  const ids: number[] = Array.isArray(body.ids)
    ? body.ids.filter((n: unknown) => Number.isInteger(n))
    : Number.isInteger(body.id) ? [body.id] : [];
  if (ids.length === 0 || ids.length > 200) return Response.json({ error: "Choose 1 to 200 concepts" }, { status: 400 });

  const error = await applyChange({
    action: body.action,
    ids,
    slug: body.action === "move" ? body.to : body.slug,
    aspect: body.aspect,
    realm: body.realm,
  });
  if (error) return Response.json({ error }, { status: 400 });
  return Response.json({ rows: await conceptRowsFor(ids) });
}
