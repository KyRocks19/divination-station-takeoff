import { NextRequest } from "next/server";
import { cleanArchetype } from "@/lib/own-archetypes-core";
import { deleteOwnArchetype, updateOwnArchetype } from "@/lib/own-archetypes";
import { bodyOf, idParam, problem, requireUser } from "@/lib/own-http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const input = cleanArchetype(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const done = await updateOwnArchetype(who.userId, id, input.value);
  return done.ok ? Response.json({ ok: true }) : problem(done.error, "archetypes");
}

/** Removes the archetype and every link to it. Its concepts stay, with no archetype. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id || !(await deleteOwnArchetype(who.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
