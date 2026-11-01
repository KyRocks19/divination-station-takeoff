import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { logAdminAction } from "@/lib/admin-log";
import { MAX_ACTIVE_TOKENS, cleanTokenInput, createWorkerToken, listWorkerTokens } from "@/lib/worker-tokens";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return null;
  return session;
}

// The owner's list of picture-computer tokens (never the tokens themselves: only a hash is kept).
export async function GET() {
  if (!(await requireAdmin())) return Response.json({ error: "Forbidden" }, { status: 403 });
  return Response.json(await listWorkerTokens());
}

// Makes a token for one picture computer. The reply holds the readable token; it cannot be shown again.
export async function POST(request: NextRequest) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
  const input = cleanTokenInput(await request.json().catch(() => ({})));
  if (!input.ok) return Response.json({ error: input.error }, { status: 400 });
  const made = await createWorkerToken(session.userId!, input);
  if (!made) return Response.json({ error: `There are already ${MAX_ACTIVE_TOKENS} tokens in use. Revoke some first.` }, { status: 409 });
  console.info(`[worker-api] ${session.username} made worker token ${made.id} "${input.name}"`);
  await logAdminAction(session, "worker_token_made", { detail: input.name });
  return Response.json(made, { status: 201 });
}
