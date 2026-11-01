import { getIronSession, IronSession } from "iron-session";
import { cookies } from "next/headers";
import { queryReadOne } from "./db";
import { AccountStateCache, sessionStands, type AccountState } from "./account-state";
import { SESSION_OPTIONS, type SessionData } from "./session-options";
import { familyCircleAllowed, familyGateRequired } from "./family-access-core";
import { isLocked, isLockedError } from "./seal";

export { SESSION_OPTIONS };
export type { SessionData };

const globalForState = globalThis as typeof globalThis & { __accountStates?: AccountStateCache };
const states = (globalForState.__accountStates ??= new AccountStateCache());

/** Forgets every account's remembered state (when a copy's data is locked, so no page goes on trusting it). */
export function forgetAllAccountStates(): void {
  states.clear();
}

/** Makes the next request on this server look the account up again (after a password change or a switch-off). */
export function forgetAccountState(userId: number): void {
  states.forget(userId);
}

async function accountState(userId: number): Promise<AccountState | null> {
  const hit = states.get(userId);
  if (hit) return hit.state;
  // Asked on nearly every page, and a plain read, so a dropped connection is retried before the person is treated as unverified.
  const state = familyGateRequired()
    ? await queryReadOne<AccountState>(
        `SELECT u.is_admin, u.disabled, u.session_version, m.circle_id
         FROM users u LEFT JOIN circle_members m ON m.user_id = u.id WHERE u.id = $1`,
        [userId]
      )
    : await queryReadOne<AccountState>("SELECT is_admin, disabled, session_version FROM users WHERE id = $1", [userId]);
  states.set(userId, state);
  return state;
}

/**
 * The signed-in session, checked against the account. A cookie that no longer stands for a live account (deleted, switched
 * off, or from before a password change) comes back empty, and the admin flag is the account's own, not the cookie's.
 */
export async function getSession(): Promise<IronSession<SessionData>> {
  const cookieStore = await cookies();
  const session = await getIronSession<SessionData>(cookieStore, SESSION_OPTIONS);
  if (!session.userId) return session;
  // A locked copy (lib/seal.ts) has nobody signed in, whatever the cookie says, until the passphrase opens it again.
  // The cookie is left as it is (it may hold the quick exit's lock, which the snake game needs); only this request sees nobody.
  if (isLocked()) {
    forgetSignIn(session);
    return session;
  }

  let state: AccountState | null;
  try {
    state = await accountState(session.userId);
  } catch (err) {
    if (isLockedError(err)) {
      forgetSignIn(session);
      return session;
    }
    if (familyGateRequired()) {
      console.warn(`[session] could not verify family-circle access: ${err instanceof Error ? err.message : err}`);
      clearSession(session);
      return session;
    }
    // The database could not be asked. The cookie is still genuine (it is signed), so the person is not thrown out for that.
    console.warn(`[session] could not check the account: ${err instanceof Error ? err.message : err}`);
    return session;
  }

  if (!sessionStands(state, session.sv) || !familyCircleAllowed(state?.circle_id)) {
    clearSession(session);
    return session;
  }
  session.isAdmin = state!.is_admin === 1;
  return session;
}

function forgetSignIn(session: IronSession<SessionData>): void {
  delete session.userId;
  delete session.username;
  delete session.isAdmin;
  delete session.sv;
}

function clearSession(session: IronSession<SessionData>): void {
  forgetSignIn(session);
  try {
    session.destroy();
  } catch {
    /* a page cannot change cookies; the next sign-in replaces it */
  }
}
