// Whether a signed-in cookie still stands for a live account. The cookie alone cannot say: it is good for two weeks, so an
// account that was deleted, switched off, or given a new password, or an admin who was made an ordinary user, would otherwise
// go on as before. The rule is kept apart from the database so it can be tested.

/** How long a sign-in lasts (open item S5: it was 30 days). People sign in again after this, or sooner with "Sign out everywhere". */
export const SESSION_DAYS = 14;

export interface AccountState {
  is_admin: number;
  disabled: number;
  session_version: number;
  circle_id?: number | null;
}

/** True when a session made with version `sv` (missing = 0) may go on for this account. A missing account never may. */
export function sessionStands(state: AccountState | null, sv: number | undefined): boolean {
  if (!state) return false;
  if (state.disabled === 1) return false;
  return state.session_version === (sv ?? 0);
}

/** How long one server remembers an account's state before it asks the database again. A change takes effect within this time. */
export const ACCOUNT_STATE_TTL_MS = 15_000;

/** Remembers recent answers; `now` is passed in so the test does not wait. */
export class AccountStateCache {
  private entries = new Map<number, { at: number; state: AccountState | null }>();
  constructor(private ttlMs = ACCOUNT_STATE_TTL_MS, private maxEntries = 500) {}

  get(userId: number, now = Date.now()): { state: AccountState | null } | undefined {
    const hit = this.entries.get(userId);
    return hit && now - hit.at < this.ttlMs ? { state: hit.state } : undefined;
  }

  set(userId: number, state: AccountState | null, now = Date.now()): void {
    if (this.entries.size >= this.maxEntries) this.entries.clear();
    this.entries.set(userId, { at: now, state });
  }

  /** Forgets one account at once (used on the server that made the change). */
  forget(userId: number): void {
    this.entries.delete(userId);
  }

  /** Forgets every account (when a copy's data is locked). */
  clear(): void {
    this.entries.clear();
  }
}
