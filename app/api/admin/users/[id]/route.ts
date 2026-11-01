import { NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import { changeUserPassword, deleteUser, getUserById, setAiDailyLimit, setClaudeAccess, setDisabled, setImageDailyLimit } from "@/lib/auth";
import { removeAllPasskeys } from "@/lib/passkeys";
import { setCanMakeCircles } from "@/lib/circles";
import { logAdminAction } from "@/lib/admin-log";
import { idParam, jsonBody } from "@/lib/own-http";

async function requireAdmin() {
  const session = await getSession();
  if (!session.userId || !session.isAdmin) return null;
  return session;
}

export async function PATCH(request: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const userId = Number(id);
  const sent = await jsonBody(request);
  if (sent instanceof Response) return sent;
  const { password, claude_access, disabled, ai_daily_limit, image_daily_limit, can_make_circles } = sent;
  if (password === undefined && claude_access === undefined && disabled === undefined && ai_daily_limit === undefined && image_daily_limit === undefined && can_make_circles === undefined) {
    return Response.json({ error: "password, claude_access, disabled, ai_daily_limit, image_daily_limit or can_make_circles is required" }, { status: 400 });
  }
  if (can_make_circles !== undefined && typeof can_make_circles !== "boolean") {
    return Response.json({ error: "can_make_circles must be true or false" }, { status: 400 });
  }
  if (image_daily_limit !== undefined && image_daily_limit !== null && (!Number.isInteger(image_daily_limit) || image_daily_limit < 0 || image_daily_limit > 1000)) {
    return Response.json({ error: "image_daily_limit must be a whole number from 0 to 1000, or null for the default" }, { status: 400 });
  }
  if (ai_daily_limit !== undefined && ai_daily_limit !== null && (!Number.isInteger(ai_daily_limit) || ai_daily_limit < 0 || ai_daily_limit > 1000)) {
    return Response.json({ error: "ai_daily_limit must be a whole number from 0 to 1000, or null for the default" }, { status: 400 });
  }
  if (disabled !== undefined && typeof disabled !== "boolean") {
    return Response.json({ error: "disabled must be true or false" }, { status: 400 });
  }
  if (disabled === true && userId === session.userId) {
    return Response.json({ error: "Cannot switch off your own account" }, { status: 400 });
  }
  if (password !== undefined && (!password || password.length < 12)) {
    return Response.json({ error: "Password must be at least 12 characters" }, { status: 400 });
  }
  if (claude_access !== undefined && typeof claude_access !== "boolean") {
    return Response.json({ error: "claude_access must be true or false" }, { status: 400 });
  }
  const user = await getUserById(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  const about = { targetId: userId, targetName: user.username };
  if (password !== undefined) { await changeUserPassword(userId, password); await removeAllPasskeys(userId); await logAdminAction(session, "password_reset", about); }
  if (claude_access !== undefined) { await setClaudeAccess(userId, claude_access); await logAdminAction(session, claude_access ? "claude_access_on" : "claude_access_off", about); }
  if (disabled !== undefined) { await setDisabled(userId, disabled); await logAdminAction(session, disabled ? "account_off" : "account_on", about); }
  if (ai_daily_limit !== undefined) { await setAiDailyLimit(userId, ai_daily_limit); await logAdminAction(session, "ai_limit_set", { ...about, detail: ai_daily_limit === null ? "the default" : String(ai_daily_limit) }); }
  if (image_daily_limit !== undefined) { await setImageDailyLimit(userId, image_daily_limit); await logAdminAction(session, "picture_limit_set", { ...about, detail: image_daily_limit === null ? "the default" : String(image_daily_limit) }); }
  if (can_make_circles !== undefined) { await setCanMakeCircles(userId, can_make_circles); await logAdminAction(session, can_make_circles ? "circles_on" : "circles_off", about); }
  return Response.json({ ok: true });
}

export async function DELETE(_req: NextRequest, ctx: RouteContext<"/api/admin/users/[id]">) {
  const session = await requireAdmin();
  if (!session) return Response.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await ctx.params;
  if (idParam(id) === null) return Response.json({ error: "Not found" }, { status: 404 });
  const userId = Number(id);
  if (userId === session.userId) {
    return Response.json({ error: "Cannot delete your own account" }, { status: 400 });
  }
  const user = await getUserById(userId);
  if (!user) return Response.json({ error: "User not found" }, { status: 404 });
  await deleteUser(userId);
  await logAdminAction(session, "account_deleted", { targetId: userId, targetName: user.username });
  return new Response(null, { status: 204 });
}
