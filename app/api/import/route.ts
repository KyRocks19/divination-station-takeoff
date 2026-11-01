import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { IMPORT_LIMITS, checkExport } from "@/lib/import-core";
import { runImport } from "@/lib/import";

// Brings a copy of the signed-in person's own export (the .json from Settings) into their account (open item ED6). Body: { data: <the export>, apply: boolean }.
// With apply false it checks and reports and writes nothing; with apply true it adds what is new, in one transaction. It only ever adds: nothing
// that is already there is changed or deleted. One import at a time for a person, so two clicks cannot add the same rows twice.
const running = new Set<number>();

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const userId = session.userId;

  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > IMPORT_LIMITS.bytes) {
    return Response.json({ error: "The file is too large to bring in at once." }, { status: 413 });
  }
  const body = (await request.json().catch(() => null)) as { data?: unknown; apply?: unknown } | null;
  const checked = checkExport(body?.data);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: 400 });

  if (running.has(userId)) return Response.json({ error: "An import is already running for your account. Wait for it to finish." }, { status: 409 });
  running.add(userId);
  try {
    return Response.json(await runImport(userId, checked.data, body?.apply === true));
  } finally {
    running.delete(userId);
  }
}
