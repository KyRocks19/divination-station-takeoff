import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
  type AuthenticationResponseJSON,
  type RegistrationResponseJSON,
} from "@simplewebauthn/server";
import { isoBase64URL } from "@simplewebauthn/server/helpers";
import { query, queryOne } from "./db";
import { clientIp, ipKey } from "./login-limit";
import { MAX_PASSKEYS } from "./passkeys-core";

export * from "./passkeys-core";

// Passkeys (S10): another way to sign in, beside the password. Every query is for one person, except finding the passkey a sign-in answer
// names, which is how the person is found. Only the public half of a passkey is kept.

const RP_NAME = "Divination Station";

export interface PasskeyRow {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

/** The person's passkeys, newest first. */
export async function listPasskeys(userId: number): Promise<PasskeyRow[]> {
  return query<PasskeyRow>("SELECT id, name, created_at, last_used_at FROM passkeys WHERE user_id = $1 ORDER BY created_at DESC, id DESC", [userId]);
}

/** The options for the browser to make a new passkey for this person on this site. Passkeys they already have on this site are excluded. */
export async function addOptions(userId: number, username: string, rpID: string) {
  const have = await query<{ credential_id: string; transports: string | null }>("SELECT credential_id, transports FROM passkeys WHERE user_id = $1 AND rp_id = $2", [userId, rpID]);
  return generateRegistrationOptions({
    rpName: RP_NAME,
    rpID,
    userName: username,
    // The account's number, not its name: it is what the device keeps to say whose passkey this is.
    userID: new TextEncoder().encode(`ds-user-${userId}`),
    attestationType: "none",
    excludeCredentials: have.map((h) => ({ id: h.credential_id, transports: h.transports ? h.transports.split(",") : undefined })),
    // A passkey the device can offer without a username first; the device asks for a fingerprint, face or PIN where it can.
    authenticatorSelection: { residentKey: "required", userVerification: "preferred" },
  });
}

export type AddResult = { ok: true; id: number } | { ok: false; error: string; status: number };

/** Checks the browser's answer to an add request and keeps the new passkey. */
export async function addPasskey(userId: number, response: RegistrationResponseJSON, challenge: string, site: { rpID: string; origin: string }, name: string): Promise<AddResult> {
  const count = await queryOne<{ n: number }>("SELECT COUNT(*)::int AS n FROM passkeys WHERE user_id = $1", [userId]);
  if ((count?.n ?? 0) >= MAX_PASSKEYS) return { ok: false, status: 409, error: `You have ${MAX_PASSKEYS} passkeys, the most an account can have. Remove one first.` };
  let verified;
  try {
    verified = await verifyRegistrationResponse({ response, expectedChallenge: challenge, expectedOrigin: site.origin, expectedRPID: site.rpID, requireUserVerification: false });
  } catch {
    return { ok: false, status: 400, error: "That passkey could not be checked. Try again." };
  }
  if (!verified.verified) return { ok: false, status: 400, error: "That passkey could not be checked. Try again." };
  const cred = verified.registrationInfo.credential;
  const row = await queryOne<{ id: number }>(
    `INSERT INTO passkeys (user_id, credential_id, public_key, counter, transports, rp_id, name) VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (credential_id) DO NOTHING RETURNING id`,
    [userId, cred.id, isoBase64URL.fromBuffer(cred.publicKey), cred.counter, cred.transports?.join(",") ?? null, site.rpID, name]
  );
  if (!row) return { ok: false, status: 409, error: "That passkey is already added." };
  return { ok: true, id: row.id };
}

/** Renames one of the person's passkeys. False when it is not theirs. */
export async function renamePasskey(userId: number, id: number, name: string): Promise<boolean> {
  return !!(await queryOne("UPDATE passkeys SET name = $1 WHERE id = $2 AND user_id = $3 RETURNING id", [name, id, userId]));
}

/** Removes one of the person's passkeys. False when it is not theirs. */
export async function removePasskey(userId: number, id: number): Promise<boolean> {
  return !!(await queryOne("DELETE FROM passkeys WHERE id = $1 AND user_id = $2 RETURNING id", [id, userId]));
}

/** Removes every passkey of an account: when its password is set again by a recovery code or by an admin, whoever else had a passkey loses it. */
export async function removeAllPasskeys(userId: number): Promise<void> {
  await query("DELETE FROM passkeys WHERE user_id = $1", [userId]);
}

/** The counters for passkey sign-in: by address only, since no username is given (the second key is the address's too, kept apart). */
export function passkeyLimitKeys(headers: Headers): { ip: string; user: string } {
  const key = ipKey("passkey-ip", clientIp(headers));
  return { ip: key, user: `passkey-again:${key}` };
}

/** The options for a sign-in: no username is asked, so the device offers the passkeys it has for this site. */
export function signInOptions(rpID: string) {
  return generateAuthenticationOptions({ rpID, userVerification: "preferred" });
}

/**
 * Checks a sign-in answer. Returns the account's id when the passkey is known, made for this site, and its signature is good; the counter
 * and the time it was last used are updated. Null for anything else (the caller answers every failure the same way).
 */
export async function checkSignIn(response: AuthenticationResponseJSON, challenge: string, site: { rpID: string; origin: string }): Promise<number | null> {
  if (typeof response?.id !== "string") return null;
  const key = await queryOne<{ id: number; user_id: number; credential_id: string; public_key: string; counter: string; transports: string | null; rp_id: string }>("SELECT id, user_id, credential_id, public_key, counter, transports, rp_id FROM passkeys WHERE credential_id = $1", [response.id]);
  if (!key || key.rp_id !== site.rpID) return null;
  let verified;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: site.origin,
      expectedRPID: site.rpID,
      requireUserVerification: false,
      credential: { id: key.credential_id, publicKey: isoBase64URL.toBuffer(key.public_key), counter: Number(key.counter), transports: key.transports?.split(",") as never },
    });
  } catch {
    return null;
  }
  if (!verified.verified) return null;
  await query("UPDATE passkeys SET counter = $1, last_used_at = NOW() WHERE id = $2", [verified.authenticationInfo.newCounter, key.id]);
  return key.user_id;
}
