import { NextRequest, after } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { toId } from "@/lib/oracle";
import { buildContextFor, type Subject } from "@/lib/companion-subject";
import { isCompanionMode } from "@/lib/companion-modes";
import { screenOutcome } from "@/lib/companion-run";
import { claimCompanionById, enqueueCompanion, processCompanionJob, storeFinishedCompanion, sweepCompanionJobs } from "@/lib/companion-queue";
import { companionEndpoint, companionMode, makeAsk } from "@/lib/companion-model";
import { signalStudio } from "@/lib/studio-signal";
import { parsePatternRef } from "@/lib/companion-pattern";

// Asks the companion for something about one reading (or, for picture ideas, one oracle item).
// Body: { divination_id | card_id, mode?: "questions" | "changes" | "reading" | "scene", acknowledged? }.
// The words are screened here first, in code. If they call for a fixed reply (crisis, or a gentle pause), that comes straight back and no
// request is queued and no model is asked. Otherwise a request is queued; the studio (or, when this server can reach the model itself, this
// server) answers it, and the page collects the answer from GET /api/companion/jobs.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getPrefs(session.userId)).companionEnabled) {
    return Response.json({ error: "The companion is switched off. Turn it on in Settings." }, { status: 403 });
  }
  const body = await request.json().catch(() => null);
  const mode = body?.mode === undefined ? "questions" : body.mode;
  if (!isCompanionMode(mode)) return Response.json({ error: "mode must be questions, changes, reading, scene, noticed, or pattern" }, { status: 400 });
  const acknowledged = body?.acknowledged === true;
  const divinationId = toId(body?.divination_id);
  const cardId = toId(body?.card_id);
  const self = body?.self === true;
  const pattern = typeof body?.pattern === "string" ? body.pattern : null;
  if (pattern !== null) {
    if (mode !== "pattern" || divinationId || cardId || self) return Response.json({ error: "A pattern is asked about with pattern and mode pattern, and nothing else." }, { status: 400 });
    if (!parsePatternRef(pattern)) return Response.json({ error: "That is not a pattern I know." }, { status: 400 });
  } else if (mode === "pattern") {
    return Response.json({ error: "Name the pattern." }, { status: 400 });
  } else if (self) {
    if (mode !== "noticed" || divinationId || cardId) return Response.json({ error: "A line for your note is asked with self and mode noticed, and nothing else." }, { status: 400 });
  } else if (!divinationId === !cardId) {
    return Response.json({ error: "Name one reading (divination_id) or one item (card_id)." }, { status: 400 });
  }
  const subject: Subject = pattern !== null ? { pattern } : self ? { self: true } : cardId ? { cardId } : { divinationId };

  const context = await buildContextFor(session.userId, subject, mode);
  if (!context) return Response.json({ error: "Not found" }, { status: 404 });
  if (mode === "changes" && !context.hasHistory) {
    return Response.json({ error: "There is nothing earlier to set beside today's words yet." }, { status: 400 });
  }

  // A suggested line is made from counts alone, so there is nothing for the screen to read.
  const first = mode === "noticed" ? null : screenOutcome(context.text, acknowledged);
  if (first) {
    console.info(`[companion] user ${session.userId}: ${first.action} because ${first.because} (screen, no model asked)`);
    return Response.json({ immediate: first }, { status: 200 });
  }

  await sweepCompanionJobs();

  // "What has changed" needs no model: the person's own words in order, built here from their exact words and dates, ready at once.
  if (mode === "changes") {
    if (!context.timeline || !divinationId) return Response.json({ error: "There is nothing earlier to set beside today's words yet." }, { status: 400 });
    const stored = await storeFinishedCompanion(session.userId, divinationId, mode, context.timeline);
    if (!stored.ok) return Response.json({ error: stored.error }, { status: stored.status });
    return Response.json({ id: stored.id, mode: "direct" }, { status: 202 });
  }

  const queued = await enqueueCompanion(session.userId, subject, mode, acknowledged);
  if (!queued.ok) return Response.json({ error: queued.error }, { status: queued.status });

  const endpoint = companionEndpoint();
  if (endpoint) {
    after(async () => {
      const job = await claimCompanionById(queued.id);
      if (job) await processCompanionJob(job, makeAsk(endpoint), endpoint.model);
    });
  } else {
    await signalStudio();
  }
  return Response.json({ id: queued.id, mode: companionMode() }, { status: 202 });
}
