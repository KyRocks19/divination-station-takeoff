import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { cleanTokenName, MAX_PERSONAL_TOKENS } from "@/lib/claude-tokens-core";
import { createClaudeToken, listClaudeTokens } from "@/lib/claude-tokens";

// The person's own tokens for the Claude tool routes: names and dates only, never the tokens.
export async function GET() {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  return Response.json(await listClaudeTokens(session.userId));
}

// Makes a token for this account. The reply holds the readable token; it cannot be shown again.
export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session.userId) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const name = cleanTokenName(body.name);
  if (!name.ok) return Response.json({ error: name.error }, { status: 400 });
  const made = await createClaudeToken(session.userId, name.name);
  if (!made) return Response.json({ error: `You already have ${MAX_PERSONAL_TOKENS} tokens in use. Revoke one first.` }, { status: 409 });
  return Response.json(made, { status: 201, headers: { "Cache-Control": "no-store" } });
}
