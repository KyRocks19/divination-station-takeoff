import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { search } from "@/lib/search";
import { cleanToday } from "@/lib/search-core";
import { MIN_QUERY, cleanOptions, cleanQuery, type SearchAnswer } from "@/lib/search-shared";

// The header's search window asks here as the person types: POST /api/search with { "q": "moon", "today": "2026-10-17" }
// (the person's own day, for dates in words such as "yesterday": the server cannot know their time zone). A POST, not a GET, so
// the words searched for are never part of an address (server logs and history keep addresses). It only reads, so
// proxy.ts does not count it as a write. The answer holds the person's own writing, so it is never cached.
const NO_STORE = { "Cache-Control": "private, no-store" };

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => null);
  const q = cleanQuery(body?.q);
  if (q.length < MIN_QUERY) return Response.json({ query: q, groups: [] } satisfies SearchAnswer, { headers: NO_STORE });

  // "options" are the extra places the person ticked in the window ("earlier", "comments"); unknown ones are ignored.
  const groups = await search(session.userId, !!session.isAdmin, q, cleanToday(body?.today), cleanOptions(body?.options));
  return Response.json({ query: q, groups } satisfies SearchAnswer, { headers: NO_STORE });
}
