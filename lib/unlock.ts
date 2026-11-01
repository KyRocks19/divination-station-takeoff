import { getLocalPool } from "./db";
import { forgetAllAccountStates } from "./session";
import { isLocked, unlockWithCode, unlockWithPassphrase } from "./seal";

// What the sign-in, the recovery page and the snake game's high-score name do on a copy whose data is locked (lib/seal.ts): the password (or a
// recovery code) opens the data first, then the account is checked as on any copy. A secret that opens the data but not the account (a wrong
// username) locks it again, so a half-right guess leaves nothing open. Server code only.

export type OpenResult = "was-open" | "opened" | "wrong";

/** Opens a locked copy with the password (`pass`) or a recovery code (`code`). */
export function openForSignIn(secret: string, kind: "pass" | "code"): OpenResult {
  if (!isLocked()) return "was-open";
  return (kind === "pass" ? unlockWithPassphrase(secret) : unlockWithCode(secret)) ? "opened" : "wrong";
}

/** Locks the copy again after `openForSignIn` opened it for a sign-in that then failed. */
export async function lockAgainIf(result: OpenResult): Promise<void> {
  if (result === "opened") await lockCopy();
}

/** Saves and locks a sealed copy now (the quick exit, a stop). Nothing happens on a copy that is not sealed. */
export async function lockCopy(): Promise<boolean> {
  const locked = (await getLocalPool()?.lockNow()) ?? false;
  if (locked) forgetAllAccountStates();
  return locked;
}
