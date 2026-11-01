import { query } from "./db";
import { clipDetail, type AdminAction, type AdminLogRow } from "./admin-log-core";

interface Who {
  userId?: number;
  username?: string;
}

/**
 * Writes one line to the admin log. It never throws: a log that cannot be written (the database blinked) must not undo or block the action that was just done, so it is reported in the server's log instead.
 * Never pass a password, a code, a token or anyone's writing as `detail`.
 */
export async function logAdminAction(
  admin: Who,
  action: AdminAction,
  about: { targetId?: number | null; targetName?: string | null; detail?: string | null } = {}
): Promise<void> {
  try {
    await query(
      "INSERT INTO admin_log (admin_id, admin_name, action, target_id, target_name, detail) VALUES ($1, $2, $3, $4, $5, $6)",
      [admin.userId ?? null, (admin.username ?? "unknown").slice(0, 100), action, about.targetId ?? null, about.targetName?.slice(0, 100) ?? null, clipDetail(about.detail)]
    );
  } catch (err) {
    console.warn(`[admin-log] could not record "${action}" by ${admin.username}: ${err instanceof Error ? err.message : err}`);
  }
}

/** The newest entries first. `before` is the id of the last entry already shown. */
export async function listAdminLog(limit = 100, before?: number): Promise<AdminLogRow[]> {
  return query<AdminLogRow>(
    `SELECT id, admin_id, admin_name, action, target_id, target_name, detail, created_at
     FROM admin_log WHERE ($2::int IS NULL OR id < $2) ORDER BY id DESC LIMIT $1`,
    [Math.min(Math.max(limit, 1), 500), before ?? null]
  );
}
