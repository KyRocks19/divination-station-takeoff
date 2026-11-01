import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { toId } from "@/lib/oracle";
import { listForSubject, listPatternJobs } from "@/lib/companion-queue";
import { capabilitiesFor, type Subject } from "@/lib/companion-subject";
import { companionMode } from "@/lib/companion-model";
import { studioStatus } from "@/lib/image-queue";

// A person's companion requests and kept answers for one reading (divination_id) or one oracle item (card_id). The page asks for this every few
// seconds while a request is waiting, so it only reads. `studio` says whether the studio on the owner's computer is awake (only meaningful when
// mode is "queue"). With caps=1 for a reading it also says which buttons the reading can have (the page asks once, when it opens).
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const p = request.nextUrl.searchParams;
  const divinationId = toId(p.get("divination_id"));
  const cardId = toId(p.get("card_id"));
  // All of the person's questions about patterns, for the Patterns page.
  if (p.get("patterns") === "1") {
    const mode = companionMode();
    return Response.json({ jobs: await listPatternJobs(session.userId), notes: [], mode, studio: mode === "queue" ? await studioStatus() : null });
  }
  const self = p.get("self") === "1";
  if (self ? !!divinationId || !!cardId : !divinationId === !cardId) return Response.json({ error: "Not found" }, { status: 404 });
  const subject: Subject = self ? { self: true } : cardId ? { cardId } : { divinationId };
  const mode = companionMode();
  const { jobs, notes } = await listForSubject(session.userId, subject);
  const caps = divinationId && p.get("caps") === "1" ? await capabilitiesFor(session.userId, divinationId) : undefined;
  return Response.json({ jobs, notes, mode, studio: mode === "queue" ? await studioStatus() : null, ...(caps ? { caps } : {}) });
}
