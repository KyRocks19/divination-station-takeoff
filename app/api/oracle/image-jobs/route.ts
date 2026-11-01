import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { getPrefs } from "@/lib/prefs";
import { cleanJobInput, circleStudioName, enqueue, imageMode, listJobs, pictureCircleOf, studioStatus, sweepJobs } from "@/lib/image-queue";
import { signalStudio } from "@/lib/studio-signal";
import { toId } from "@/lib/oracle";
import { configuredFamilyCircleId } from "@/lib/family-access-core";

// The person's pictures waiting for the owner's computer (lib/image-queue.ts). The page asks for this every few seconds while
// pictures are waiting, so it only reads.
export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const cardParam = request.nextUrl.searchParams.get("card_id");
  const jobs = await listJobs(session.userId, cardParam ? toId(cardParam) : null);
  return Response.json({ jobs, studio: await studioFor(session.userId) });
}

// Asks for pictures. Body: { prompt, form, count?, card_id? }. They go to the back of the line; nothing is charged beyond the
// person's limits for waiting pictures and pictures per day.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  if (!(await getPrefs(session.userId)).artHelp) {
    return Response.json({ error: "Making pictures is switched off in Settings." }, { status: 403 });
  }
  if (imageMode() !== "queue") {
    return Response.json({ error: "This copy of the app makes pictures directly, not through a queue." }, { status: 400 });
  }
  const checked = cleanJobInput(await request.json().catch(() => null));
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

  await sweepJobs();
  const result = await enqueue(session.userId, checked.input);
  if (!result.ok) return Response.json({ error: result.error }, { status: result.status });
  // The doorbell is the app's own studio's; a circle's computer looks at the queue on its own schedule.
  if (result.circleId === configuredFamilyCircleId()) await signalStudio();
  return Response.json({ ids: result.ids, studio: await studioFor(session.userId) }, { status: 201 });
}

/** Whether the computer that makes this person's pictures is awake, and which circle's it is when it is a circle's (the page says so in its words). */
async function studioFor(userId: number) {
  const circleId = await pictureCircleOf(userId);
  const status = await studioStatus(new Date(), circleId);
  return { ...status, circle_name: circleId === null ? null : await circleStudioName(circleId) };
}
