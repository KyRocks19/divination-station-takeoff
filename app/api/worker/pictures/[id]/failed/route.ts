import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { failJob } from "@/lib/image-queue";
import { cleanFailStatus, wordsForPerson } from "@/lib/worker-protocol";

// The studio could not make a picture it claimed. It sends a status number ({ status: 504 } for too slow, 499 for stopped, anything else for
// "could not make it"); the website chooses the words the person sees, so a studio can never write to people. The day's count goes back.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const worker = await requireWorker(request, "pictures");
  if (worker instanceof Response) return worker;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const marked = await failJob(id, wordsForPerson(cleanFailStatus(body?.status)), worker.id);
  return Response.json({ marked });
}
