import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { recordHeartbeat, sweepJobs } from "@/lib/image-queue";
import { sweepCompanionJobs } from "@/lib/companion-queue";
import { cleanPollSeconds } from "@/lib/worker-protocol";

// The studio says it is awake (each time it looks at the queue), or that it is stopping ({ asleep: true }), so the website can say awake or
// asleep when it has no Redis. Old rows are swept at the same time, as the studio used to do itself.
export async function POST(request: NextRequest) {
  const worker = await requireWorker(request);
  if (worker instanceof Response) return worker;
  const body = await request.json().catch(() => ({}));
  const asleep = body?.asleep === true;
  if (!asleep) {
    if (worker.pictures) await sweepJobs();
    if (worker.companion) await sweepCompanionJobs();
  }
  await recordHeartbeat(cleanPollSeconds(body?.pollSeconds), asleep, new Date(), worker.circleId);
  return Response.json({ ok: true });
}
