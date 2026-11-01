// What the admin log says in words (open item S6). Pure; no imports, so the browser can use it.

export const ADMIN_ACTIONS = [
  "account_created",
  "account_deleted",
  "password_reset",
  "account_off",
  "account_on",
  "claude_access_on",
  "claude_access_off",
  "ai_limit_set",
  "picture_limit_set",
  "circles_on",
  "circles_off",
  "invite_made",
  "invite_revoked",
  "worker_token_made",
  "worker_token_revoked",
  "report_kept",
  "report_deleted",
  "symbol_links_changed",
  "card_concepts_changed",
  "local_backup_made",
  "local_backup_restored",
  "host_name_added",
  "host_name_removed",
  "host_acknowledged",
  "source_note_changed",
  "forum_bundle_imported",
] as const;

export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export interface AdminLogRow {
  id: number;
  admin_id: number | null;
  admin_name: string;
  action: string;
  target_id: number | null;
  target_name: string | null;
  detail: string | null;
  created_at: string;
}

const WORDS: Record<AdminAction, (who: string, detail: string | null) => string> = {
  account_created: (who) => `made the account ${who}`,
  account_deleted: (who) => `deleted the account ${who}`,
  password_reset: (who) => `reset the password of ${who}`,
  account_off: (who) => `switched off ${who}`,
  account_on: (who) => `switched ${who} back on`,
  claude_access_on: (who) => `allowed the shared Claude key for ${who}`,
  claude_access_off: (who) => `stopped the shared Claude key for ${who}`,
  ai_limit_set: (who, d) => `set the daily Claude limit of ${who}${d ? ` to ${d}` : ""}`,
  picture_limit_set: (who, d) => `set the daily picture limit of ${who}${d ? ` to ${d}` : ""}`,
  circles_on: (who) => `let ${who} make a circle`,
  circles_off: (who) => `stopped ${who} making a circle`,
  invite_made: (_w, d) => `made an invite code${d ? ` (${d})` : ""}`,
  invite_revoked: (_w, d) => `revoked an invite code${d ? ` (${d})` : ""}`,
  worker_token_made: (_w, d) => `made a picture-computer token${d ? ` (${d})` : ""}`,
  worker_token_revoked: (_w, d) => `revoked a picture-computer token${d ? ` (${d})` : ""}`,
  report_kept: (_w, d) => `kept a reported ${d ?? "post"} after looking at it`,
  report_deleted: (_w, d) => `deleted a reported ${d ?? "post"}`,
  local_backup_made: (_w, d) => `made a backup of this copy${d ? ` (${d})` : ""}`,
  local_backup_restored: (_w, d) => `replaced everything in this copy with a backup${d ? ` (${d})` : ""}`,
  symbol_links_changed: (who, d) => `changed the shared archetypes of ${who}${d ? ` (${d})` : ""}`,
  card_concepts_changed: (who, d) => `changed the shared concepts of ${who}${d ? ` (${d})` : ""}`,
  host_name_added: (_w, d) => `let this copy answer to ${d ?? "a new address"}`,
  host_name_removed: (_w, d) => `stopped this copy answering to ${d ?? "an address"}`,
  host_acknowledged: () => "confirmed what hosting a circle means for its members' privacy",
  source_note_changed: (_w, d) => `changed the note on a source${d ? ` (${d})` : ""}`,
  forum_bundle_imported: (_w, d) => `brought a forum file from another host into the circle${d ? ` (${d})` : ""}`,
};

/** One log row as a sentence without the name of the admin or the date: "reset the password of kylie". */
export function describeAdminAction(row: Pick<AdminLogRow, "action" | "target_name" | "detail">): string {
  const who = row.target_name ? `“${row.target_name}”` : "an account";
  const make = WORDS[row.action as AdminAction];
  return make ? make(who, row.detail) : `did “${row.action}”`;
}

/** Shortens a free-text detail so a row stays one line and never carries a long text. */
export function clipDetail(detail: unknown, max = 120): string | null {
  if (typeof detail !== "string") return null;
  const flat = detail.replace(/\s+/g, " ").trim();
  return flat ? flat.slice(0, max) : null;
}
