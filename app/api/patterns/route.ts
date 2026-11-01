import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { DIVINATION_KINDS, type DivinationKind } from "@/lib/divination-kinds";
import { loadPatterns } from "@/lib/patterns";
import { examplePatterns } from "@/lib/patterns-example";

// The signed-in person's own patterns across their tools: when they read, themes over time, symbols that keep coming up, and how their own wording
// has shifted. `tools=runes,tarot` limits it to those tools (omit it for every tool). Only ever the person's own data; it never reads anyone else's.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  // Example data (release plan idea 7): made in code each time and never stored; the page labels it as an example.
  if (request.nextUrl.searchParams.get("example") === "1") return Response.json(examplePatterns());
  const raw = request.nextUrl.searchParams.get("tools");
  let only: DivinationKind[] | null = null;
  if (raw !== null) {
    only = raw.split(",").filter((k): k is DivinationKind => (DIVINATION_KINDS as string[]).includes(k));
    if (only.length === 0) return Response.json({ error: "tools must name at least one tool" }, { status: 400 });
  }
  return Response.json(await loadPatterns(session.userId, only));
}
