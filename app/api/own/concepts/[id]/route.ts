import { NextRequest } from "next/server";
import { cleanConcept } from "@/lib/own-archetypes-core";
import { deleteOwnConcept, updateOwnConcept } from "@/lib/own-archetypes";
import { bodyOf, idParam, problem, requireUser } from "@/lib/own-http";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id) return Response.json({ error: "Not found" }, { status: 404 });
  const input = cleanConcept(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const done = await updateOwnConcept(who.userId, id, input.value);
  return done.ok ? Response.json({ ok: true }) : problem(done.error, "concepts");
}

/** Removes the concept and every link to it. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const id = idParam((await params).id);
  if (!id || !(await deleteOwnConcept(who.userId, id))) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ ok: true });
}
