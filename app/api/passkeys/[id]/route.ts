import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { idParam } from "@/lib/own-http";
import { cleanPasskeyName, removePasskey, renamePasskey } from "@/lib/passkeys";

/** Renames one of the person's passkeys. */
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });
  const body = await request.json().catch(() => null);
  const name = cleanPasskeyName(body?.name);
  if (!name) return Response.json({ error: "Give the passkey a name." }, { status: 400 });
  return (await renamePasskey(session.userId, id, name)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}

/** Removes one of the person's passkeys. Signing in with the password still works. */
export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const id = idParam((await params).id);
  if (id === null) return Response.json({ error: "Not found" }, { status: 404 });
  return (await removePasskey(session.userId, id)) ? Response.json({ ok: true }) : Response.json({ error: "Not found" }, { status: 404 });
}
