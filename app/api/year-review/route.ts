import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { formatYearReview, isReviewYear } from "@/lib/year-review-core";
import { loadYearReview } from "@/lib/year-review";

// The yearly review (release plan §6 idea 8): one year of the person's own readings and words as a Markdown file to keep on their device.
// GET ?year=2026. Only the person's own; nothing is stored or sent anywhere else.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const year = Number(request.nextUrl.searchParams.get("year"));
  if (!isReviewYear(year)) return Response.json({ error: "year must be a year from 2000 to this one" }, { status: 400 });
  const text = formatYearReview(await loadYearReview(session.userId, year));
  return new Response(text, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="my-year-${year}.md"`,
      "Cache-Control": "no-store",
    },
  });
}
