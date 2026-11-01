import { NextRequest } from "next/server";
import { cleanConcept } from "@/lib/own-archetypes-core";
import { createOwnConcept, listOwnConcepts } from "@/lib/own-archetypes";
import { bodyOf, problem, requireUser } from "@/lib/own-http";

// The signed-in person's own concepts. Private to them; none touches the shared concepts.

export async function GET() {
  const who = await requireUser();
  if ("response" in who) return who.response;
  return Response.json(await listOwnConcepts(who.userId));
}

export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const input = cleanConcept(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const made = await createOwnConcept(who.userId, input.value);
  if (!made.ok) return problem(made.error, "concepts");
  return Response.json({ id: made.value.id }, { status: 201 });
}
