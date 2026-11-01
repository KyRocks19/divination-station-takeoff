import { NextRequest } from "next/server";
import { bodyOf, idParam, requireUser } from "@/lib/own-http";
import { KIND_HAS_FACING, cleanPlacements, landing, randomPlace, type PlacementInput } from "@/lib/cloth-core";
import { charmLandings, clearPlacements, clothKindOf, itemsOf, loadCloth, placementsOf, savePlacements } from "@/lib/cloths";
import { createRng } from "@/lib/rng";
import { queryOne } from "@/lib/db";

// Where the items of one of the person's own readings landed on a cloth (open item T4). GET: the items, what is recorded, and whether the tool
// asks how an item faced. PUT: record where real items landed (the person says which zone, or taps the cloth). POST: let the app throw the items
// onto a cloth and say which zone each fell into. DELETE: forget what was recorded. Only the reading's owner, only the tools in CLOTH_KINDS. A charm cast can
// also be laid onto a cloth exactly as it fell (POST with from_cast).
type Ctx = { params: Promise<{ id: string }> };

/** The reading named in the address, when it is the signed-in person's own and of a kind that can be recorded on a cloth. */
async function open(userId: number, params: Ctx["params"]) {
  const id = idParam((await params).id);
  const kind = id ? await clothKindOf(userId, id) : null;
  if (!id || !kind) return { response: Response.json({ error: "Not found" }, { status: 404 }) };
  return { userId, id, kind };
}

export async function GET(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const o = await open(who.userId, params);
  if ("response" in o) return o.response;
  const items = await itemsOf(o.userId, o.id, o.kind);
  const recorded = await placementsOf(o.userId, o.id);
  return Response.json({ kind: o.kind, has_facing: KIND_HAS_FACING[o.kind], items, recorded });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const o = await open(who.userId, params);
  if ("response" in o) return o.response;
  const body = (await bodyOf(request)) as { cloth_id?: unknown; placements?: unknown } | null;
  const clothId = idParam(String(body?.cloth_id ?? ""));
  const cloth = clothId ? await loadCloth(o.userId, clothId) : null;
  if (!cloth) return Response.json({ error: "Choose one of your cloths." }, { status: 404 });
  const items = await itemsOf(o.userId, o.id, o.kind);
  const clean = cleanPlacements(body?.placements, items.length, cloth.zones, KIND_HAS_FACING[o.kind]);
  if (!clean.ok) return Response.json({ error: clean.error }, { status: 400 });
  await savePlacements(o.userId, o.id, cloth, items, clean.list.map((p) => ({ ...p, simulated: false })));
  return Response.json({ ok: true, recorded: await placementsOf(o.userId, o.id) });
}

export async function POST(request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const o = await open(who.userId, params);
  if ("response" in o) return o.response;
  const body = (await bodyOf(request)) as { cloth_id?: unknown; from_cast?: unknown } | null;
  const clothId = idParam(String(body?.cloth_id ?? ""));
  const cloth = clothId ? await loadCloth(o.userId, clothId) : null;
  if (!cloth) return Response.json({ error: "Choose one of your cloths." }, { status: 404 });
  const items = await itemsOf(o.userId, o.id, o.kind);
  if (!items.length) return Response.json({ error: "This reading has no items to throw." }, { status: 400 });
  if (body?.from_cast === true) {
    // A charm cast already says where each charm landed on the same 0 to 1000 square, so it is laid onto the cloth as it fell, side and all.
    if (o.kind !== "charms") return Response.json({ error: "Only a charm cast can be laid onto a cloth as it fell." }, { status: 400 });
    const landed = await charmLandings(o.userId, o.id);
    const list: PlacementInput[] = items.map((item) => {
      const { x, y, face } = landed[item.index];
      const l = landing(cloth.zones, x, y);
      return { index: item.index, where: l.kind === "zone" ? "zone" : l.kind, zone: l.kind === "zone" ? l.zone.name : null, x, y, facing: face, simulated: true };
    });
    await savePlacements(o.userId, o.id, cloth, items, list);
    return Response.json({ ok: true, recorded: await placementsOf(o.userId, o.id) });
  }
  // The random source is the one the person chose in Settings, as for a throw of dice.
  const user = await queryOne<{ rng_method: string | null }>("SELECT rng_method FROM users WHERE id = $1", [o.userId]);
  const rng = await createRng(user?.rng_method ?? "math");
  const hasFacing = KIND_HAS_FACING[o.kind];
  const list: PlacementInput[] = items.map((item) => {
    const { x, y } = randomPlace(rng);
    const l = landing(cloth.zones, x, y);
    return {
      index: item.index,
      where: l.kind === "zone" ? "zone" : l.kind,
      zone: l.kind === "zone" ? l.zone.name : null,
      x,
      y,
      // A thrown rune or stave lands face up or face down by chance; a die or coin shows its face already.
      facing: hasFacing ? (rng() < 0.5 ? "up" : "down") : null,
      simulated: true,
    };
  });
  await savePlacements(o.userId, o.id, cloth, items, list);
  return Response.json({ ok: true, recorded: await placementsOf(o.userId, o.id) });
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const o = await open(who.userId, params);
  if ("response" in o) return o.response;
  await clearPlacements(o.userId, o.id);
  return new Response(null, { status: 204 });
}
