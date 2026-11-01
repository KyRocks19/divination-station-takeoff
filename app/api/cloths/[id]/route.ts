import { NextRequest } from "next/server";
import { bodyOf, idParam, requireUser } from "@/lib/own-http";
import { cleanCloth } from "@/lib/cloth-core";
import { deleteCloth, loadCloth, updateCloth } from "@/lib/cloths";

// One of the signed-in person's cloths: read it, replace its name, description and zones, or delete it. Where items landed on it stays in the
// readings that recorded it (they keep the cloth's and the zones' names as they were).
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const cloth = await loadCloth(who.userId, id);
  return cloth ? Response.json(cloth) : Response.json({ error: "Not found" }, { status: 404 });
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const input = cleanCloth(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  if (!(await updateCloth(who.userId, id, input))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(await loadCloth(who.userId, id));
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  if (!(await deleteCloth(who.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(null, { status: 204 });
}
