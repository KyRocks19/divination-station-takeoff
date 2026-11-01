import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { listUsers, createUser } from "@/lib/auth";
import { usageToday } from "@/lib/ai-quota";
import { joinProblem } from "@/lib/invites";
import { queryOne } from "@/lib/db";
import { logAdminAction } from "@/lib/admin-log";
import { jsonBody } from "@/lib/own-http";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return null;
  return session;
}

export async function GET() {
  if (!await requireAdmin()) return Response.json({ error: "Forbidden" }, { status: 403 });
  const [users, usage] = await Promise.all([listUsers(), usageToday()]);
  return Response.json(users.map((u) => ({ ...u, ai_today: usage.get(u.id)?.calls ?? 0, pictures_today: usage.get(u.id)?.pictures ?? 0 })));
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { username, display_name, password, is_admin } = sent;
  if (typeof username !== "string" || typeof password !== "string" || !username || !password) {
    return Response.json({ error: "username and password are required" }, { status: 400 });
  }
  // The same rules as joining with a code (lib/invites.ts), so an account made here looks like any other.
  const problem = joinProblem(username, password, display_name ?? undefined);
  if (problem) return Response.json({ error: problem }, { status: 400 });
  // A name that differs only by capitals is the same name to the people reading the forum.
  if (await queryOne("SELECT 1 FROM users WHERE LOWER(username) = LOWER($1)", [username.trim()])) {
    return Response.json({ error: "Username already taken" }, { status: 409 });
  }
  try {
    const user = await createUser(username.trim(), display_name ?? null, password, is_admin === true);
    await logAdminAction(admin, "account_created", { targetId: user.id, targetName: user.username, detail: is_admin === true ? "an admin" : null });
    const { password_hash: _, ...safe } = user as any;
    return Response.json(safe, { status: 201 });
  } catch {
    return Response.json({ error: "Username already taken" }, { status: 409 });
  }
}
