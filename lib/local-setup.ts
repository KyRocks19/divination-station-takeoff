import { queryOne } from "./db";
import { localDbDir } from "./local-db-core";
import { isLocked } from "./seal";
import { isLocalEdition } from "./edition";
import { LOOPBACK_HOSTS, cameThroughProxy, hostName, type HeaderReader } from "./host-guard";

// First-run set-up of a copy that keeps its data in a folder on the computer (open item ED9): until someone has made the one account, every page
// leads to /setup. It exists only in the local edition (Winged or Feathered), when DS_DB_DIR is set and the users table is empty. A hosted copy never
// offers it, even one that keeps its data in a DS_DB_DIR folder (the family circle after the move off Neon, docs/move-off-neon.md): its accounts come
// from the move or from invites, so an empty folder there means the folder is the wrong one, and the sign-in page says so (hostedFolderEmpty). Server code only.

async function noAccounts(): Promise<boolean> {
  const row = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM users");
  return (row?.n ?? 0) === 0;
}

/** True while this is a local copy with no account yet. */
export async function needsSetup(): Promise<boolean> {
  // A locked copy has an account (whoever locked it), and its database cannot be asked until it is opened.
  if (!localDbDir() || isLocked() || !isLocalEdition()) return false;
  return noAccounts();
}

/** True for a hosted copy whose DS_DB_DIR folder has no accounts: most likely the move off Neon did not fill it, or DS_DB_DIR names another folder. */
export async function hostedFolderEmpty(): Promise<boolean> {
  if (!localDbDir() || isLocked() || isLocalEdition()) return false;
  return noAccounts();
}

/**
 * Whether a request reached this copy by a name that means this computer. The set-up page asks nothing but a name and a password, so whoever
 * gets there first owns the copy; a copy started so that other computers can reach it must not let one of them be first. The Host header alone
 * can be forged by a friend reaching the copy through a proxy, so a request a proxy passed on is refused too (lib/host-guard.ts cameThroughProxy).
 */
export function reachedOnThisComputer(hostHeader: string | null | undefined, headers: HeaderReader): boolean {
  return LOOPBACK_HOSTS.includes(hostName(hostHeader)) && !cameThroughProxy(headers);
}
