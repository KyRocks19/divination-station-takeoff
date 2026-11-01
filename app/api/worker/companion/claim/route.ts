import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { claimNextCompanion, stepCompanionJob } from "@/lib/companion-queue";
import { clip } from "@/lib/limits";
import type { CompanionJob } from "@/lib/worker-protocol";

// The studio takes the oldest waiting companion request. The reply is the request and its first step: a model call to make ({ ask }), or, when
// the website's own screen already answered it, the result. { job: null } when nothing is waiting. Only for a token allowed companion requests.
export async function POST(request: NextRequest) {
  const worker = await requireWorker(request, "companion");
  if (worker instanceof Response) return worker;
  const body = await request.json().catch(() => ({}));
  const claimed = await claimNextCompanion(worker.id);
  if (!claimed) return Response.json({ job: null });
  const job: CompanionJob = { id: claimed.id, user_id: claimed.user_id, mode: claimed.mode };
  const step = await stepCompanionJob(claimed, [], clip(body?.model, 100) || "studio");
  return Response.json({ job, ...step });
}
