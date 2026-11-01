import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { jobImage } from "@/lib/image-queue";
import { toId } from "@/lib/oracle";
import { idParam } from "@/lib/own-http";

// The finished picture, for the person who asked for it only.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const image = await jobImage(session.userId, toId(id));
  if (!image) return Response.json({ error: "Not found" }, { status: 404 });
  return new Response(new Uint8Array(image.bytes), {
    headers: { "Content-Type": image.mime, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
  });
}
