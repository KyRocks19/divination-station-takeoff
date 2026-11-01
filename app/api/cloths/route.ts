import { NextRequest } from "next/server";
import { bodyOf, requireUser } from "@/lib/own-http";
import { MAX_CLOTHS, cleanCloth } from "@/lib/cloth-core";
import { createCloth, listCloths, loadCloth } from "@/lib/cloths";

// The signed-in person's cloths. Private to them: every query is for one person. The app supplies no cloths and no zone meanings.

export async function GET() {
  const who = await requireUser();
  if ("response" in who) return who.response;
  return Response.json(await listCloths(who.userId));
}

export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const input = cleanCloth(await bodyOf(request));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const id = await createCloth(who.userId, input);
  if (id === null) return Response.json({ error: `You have ${MAX_CLOTHS} cloths, which is the most for now. Delete one to make another.` }, { status: 409 });
  return Response.json(await loadCloth(who.userId, id), { status: 201 });
}
