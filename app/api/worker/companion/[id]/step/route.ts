import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { claimedCompanionForWorker, stepCompanionJob } from "@/lib/companion-queue";
import { clip } from "@/lib/limits";
import { cleanAnswers } from "@/lib/worker-protocol";

// The next step of a companion request this studio claimed. The body is every model answer so far, in order ({ answers: [...] }), or
// { failed: true } when the studio could not reach its model. The website runs the whole path again with those answers (every safety check
// stays here) and replies with the next model call ({ ask }) or the result ({ result: "done" | "cancelled" | "failed" }).
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const worker = await requireWorker(request, "companion");
  if (worker instanceof Response) return worker;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const answers = body?.failed === true ? "failed" : cleanAnswers(body?.answers);
  if (answers === null) return Response.json({ error: "answers must be a list of at most four answers" }, { status: 400 });
  const job = await claimedCompanionForWorker(id, worker.id);
  // Not this studio's, or the person cancelled it, or it was already answered: nothing more to do.
  if (!job) return Response.json({ result: "cancelled" });
  return Response.json(await stepCompanionJob(job, answers, clip(body?.model, 100) || "studio"));
}
