import { NextRequest } from "next/server";
import { cleanArchetype } from "@/lib/own-archetypes-core";
import { createOwnArchetype, listOwnArchetypes } from "@/lib/own-archetypes";
import { bodyOf, problem, requireUser } from "@/lib/own-http";

// The signed-in person's own archetypes. Private to them: every query is for one person, and none touches the shared archetypes.

export async function GET() {
  const who = await requireUser();
  if ("response" in who) return who.response;
  return Response.json(await listOwnArchetypes(who.userId));
}

export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const input = cleanArchetype(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const made = await createOwnArchetype(who.userId, input.value);
  if (!made.ok) return problem(made.error, "archetypes");
  return Response.json({ id: made.value.id }, { status: 201 });
}
