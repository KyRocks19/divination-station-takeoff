import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { recordHeartbeat, requeueStale, sweepJobs } from "@/lib/image-queue";
import { requeueStaleCompanion, sweepCompanionJobs } from "@/lib/companion-queue";
import { cleanPollSeconds } from "@/lib/worker-protocol";

// The picture studio says hello when it starts (scripts/image-worker.ts). Its own jobs left "running" by an earlier run go back in the queue,
// old rows are swept, and the reply says what this token may take, so the studio can say so in its window.
export async function POST(request: NextRequest) {
  const worker = await requireWorker(request);
  if (worker instanceof Response) return worker;
  const body = await request.json().catch(() => ({}));
  const requeued = { pictures: 0, companion: 0 };
  if (worker.pictures) {
    await sweepJobs();
    requeued.pictures = await requeueStale(worker.id);
  }
  if (worker.companion) {
    await sweepCompanionJobs();
    requeued.companion = await requeueStaleCompanion(worker.id);
  }
  await recordHeartbeat(cleanPollSeconds(body?.pollSeconds), false, new Date(), worker.circleId);
  console.info(`[worker-api] studio "${worker.name}" (token ${worker.id}) said hello`);
  return Response.json({ name: worker.name, pictures: worker.pictures, companion: worker.companion, requeued, circle: worker.circleId !== null });
}
