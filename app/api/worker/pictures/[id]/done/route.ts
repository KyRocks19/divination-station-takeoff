import { NextRequest } from "next/server";
import { requireWorker } from "@/lib/worker-tokens";
import { finishJob } from "@/lib/image-queue";
import { sniffImage } from "@/lib/oracle-art";
import { MAX_RESULT_BYTES } from "@/lib/worker-protocol";

// The studio sends back a finished picture: the picture's own bytes as the body (WebP, PNG, or JPEG, checked by their first bytes, not by
// what the studio says). Only for a picture this studio claimed. { kept: false } when the person cancelled it meanwhile.
export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const worker = await requireWorker(request, "pictures");
  if (worker instanceof Response) return worker;
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id) || id < 1) return Response.json({ error: "Not found" }, { status: 404 });
  const bytes = Buffer.from(await request.arrayBuffer());
  if (bytes.length === 0) return Response.json({ error: "No picture was sent" }, { status: 400 });
  if (bytes.length > MAX_RESULT_BYTES) return Response.json({ error: "That picture is too big to keep" }, { status: 413 });
  const mime = sniffImage(bytes);
  if (!mime) return Response.json({ error: "That is not a WebP, PNG, or JPEG picture" }, { status: 415 });
  const kept = await finishJob(id, bytes, mime, worker.id);
  return Response.json({ kept });
}
