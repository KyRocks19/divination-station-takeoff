// Claude's own test accounts. Each session makes one named "claude" or "claude-" plus a date and letters (the old
// shared one is just "claude"). The Users page can show them as one row or hide them. This file touches no database
// code, so the page's browser code can import it.

export type ClaudeAccountView = "group" | "each" | "hide";

export const CLAUDE_ACCOUNT_VIEWS: { value: ClaudeAccountView; label: string }[] = [
  { value: "group", label: "One row" },
  { value: "each", label: "Show each" },
  { value: "hide", label: "Hide" },
];

/** True for a name like "claude" or "claude-1014-src". "claudette" is somebody else. */
export function isClaudeAccountName(username: string): boolean {
  return /^claude(-|$)/i.test(username.trim());
}

interface Sortable {
  username: string;
  is_admin: number;
}

/**
 * Splits a user list into the people and Claude's test accounts. An administrator is never counted as a test account,
 * and neither is the person looking at the list, so nobody can hide the account they are signed in with.
 */
export function splitClaudeAccounts<T extends Sortable>(users: T[], me: string | null): { people: T[]; claude: T[] } {
  const people: T[] = [];
  const claude: T[] = [];
  for (const u of users) {
    if (isClaudeAccountName(u.username) && u.is_admin !== 1 && u.username !== me) claude.push(u);
    else people.push(u);
  }
  return { people, claude };
}

/** Reads a saved choice, falling back to one row. */
export function parseClaudeAccountView(saved: string | null | undefined): ClaudeAccountView {
  return saved === "each" || saved === "hide" || saved === "group" ? saved : "group";
}
