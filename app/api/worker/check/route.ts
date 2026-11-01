import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";

// The picture studio's test (`--check`, scripts/image-worker.ts): is the token accepted, and what may it do? It changes nothing: unlike
// "hello" it does not put jobs back in the queue and does not mark the studio awake, so it is safe to run while a studio is working.
export async function POST(request: NextRequest) {
  const worker = await requireWorker(request);
  if (worker instanceof Response) return worker;
  return Response.json({ name: worker.name, pictures: worker.pictures, companion: worker.companion, circle: worker.circleId !== null });
}
