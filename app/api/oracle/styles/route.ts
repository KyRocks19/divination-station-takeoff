import { NextRequest } from "next/server";
import { bodyOf, idParam, requireUser } from "@/lib/own-http";
import { MAX_STYLE_LENGTH } from "@/lib/art-maker";
import { MAX_ART_STYLES, cleanStyleName, cleanStyleText } from "@/lib/art-styles-core";
import { createStyle, deckStyle, listStyles } from "@/lib/art-styles";

// The picture-maker's saved style notes for the signed-in person. GET (with ?deck=ID) gives their named styles and the note saved for that set.
// POST saves a named style. Private to the person: every query is for one person. A style note only describes how a picture looks.
export async function GET(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const deckId = idParam(request.nextUrl.searchParams.get("deck") ?? "");
  const [styles, set] = await Promise.all([listStyles(who.userId), deckId ? deckStyle(who.userId, deckId) : Promise.resolve(null)]);
  return Response.json({ styles, deck_style: set });
}

export async function POST(request: NextRequest) {
  const who = await requireUser();
  if ("response" in who) return who.response;
  const body = (await bodyOf(request)) as { name?: unknown; text?: unknown } | null;
  const name = cleanStyleName(body?.name);
  const text = cleanStyleText(body?.text);
  if (!name) return Response.json({ error: "Give the style a name of 1 to 40 characters." }, { status: 400 });
  if (!text) return Response.json({ error: `Write the style note first: it can be up to ${MAX_STYLE_LENGTH} characters.` }, { status: 400 });
  const made = await createStyle(who.userId, name, text);
  if (made.ok) return Response.json(made.style, { status: 201 });
  if (made.problem === "limit") return Response.json({ error: `You have ${MAX_ART_STYLES} saved styles, which is the most for now. Remove one to save another.` }, { status: 409 });
  return Response.json({ error: "You already have a style with that name." }, { status: 409 });
}
