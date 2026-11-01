import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { claimNext } from "@/lib/image-queue";
import type { PictureJob } from "@/lib/worker-protocol";

// The studio takes the next waiting picture from its own queue: the app's, or its circle's (people take turns; see claimNext). { job: null } when nothing is waiting.
export async function POST(request: NextRequest) {
  const worker = await requireWorker(request, "pictures");
  if (worker instanceof Response) return worker;
  const claimed = await claimNext(worker.id, worker.circleId);
  const job: PictureJob | null = claimed ? { id: claimed.id, user_id: claimed.user_id, prompt: claimed.prompt, form: claimed.form } : null;
  return Response.json({ job });
}
