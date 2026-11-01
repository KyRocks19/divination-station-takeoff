// Passkeys (S10): the parts that touch no database, so the settings card and the tests can import them.

export const PASSKEY_NAME_MAX = 60;
/** How many passkeys one account can have. */
export const MAX_PASSKEYS = 10;
/** How long a sign-in or add request may take, from asking the device to its answer. */
export const CHALLENGE_MINUTES = 5;

/** A passkey's name: trimmed, one line, 1 to 60 characters. Null when nothing is left. */
export function cleanPasskeyName(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const name = raw.replace(/\s+/g, " ").trim().slice(0, PASSKEY_NAME_MAX);
  return name || null;
}

/** A waiting request in the session: its random challenge, what it is for, and when it was made. */
export interface PendingChallenge {
  c: string;
  for: "add" | "signin";
  at: number;
}

/** The challenge, when there is one for this purpose and it is not too old. */
export function freshChallenge(pending: PendingChallenge | undefined, purpose: PendingChallenge["for"], now = Date.now()): string | null {
  if (!pending || pending.for !== purpose || typeof pending.c !== "string") return null;
  return now - pending.at <= CHALLENGE_MINUTES * 60_000 && now >= pending.at ? pending.c : null;
}

/**
 * The site a passkey belongs to, from the address the request came to: the host name without the port (the "relying party id") and the
 * origin the browser will report. proxy.ts has already refused a host this copy does not answer to.
 */
export function siteOf(url: string): { rpID: string; origin: string } {
  const u = new URL(url);
  return { rpID: u.hostname, origin: u.origin };
}
