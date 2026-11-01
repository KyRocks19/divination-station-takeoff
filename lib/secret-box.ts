import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// Keeps a secret that the server must be able to use again (a Claude key a circle's owner brings; migration 065) in the database in a form
// that is useless without a master key. AES-256-GCM: the master key is only in the server's environment (CIRCLE_KEY_SECRET), never in the
// database or in git; each secret gets its own random 12-byte iv; the tag makes any change to the stored bytes fail instead of decrypting to
// something else. `aad` (here "circle:<id>") is bound to the ciphertext, so a stored secret copied into another circle's row does not open.
// Server code only. Nothing here logs, returns or throws a secret.

export const SECRET_ENV = "CIRCLE_KEY_SECRET";

export interface SealedSecret {
  ciphertext: Buffer;
  iv: Buffer;
  tag: Buffer;
}

/**
 * The master key from the environment: 32 bytes written as 64 hex characters or as base64 (44 characters). Null when it is missing or the
 * wrong size, so the caller can say "not set up" rather than encrypt with a weak key.
 * Make one with:  node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
 */
export function masterKey(env: Record<string, string | undefined> = process.env): Buffer | null {
  const raw = env[SECRET_ENV]?.trim();
  if (!raw) return null;
  const key = /^[0-9a-fA-F]{64}$/.test(raw) ? Buffer.from(raw, "hex") : Buffer.from(raw, "base64");
  return key.length === 32 ? key : null;
}

export function seal(plain: string, aad: string, key: Buffer): SealedSecret {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  cipher.setAAD(Buffer.from(aad, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return { ciphertext, iv, tag: cipher.getAuthTag() };
}

/** The secret, or null when the key, the aad or any stored byte is wrong. */
export function open(sealed: SealedSecret, aad: string, key: Buffer): string | null {
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
    decipher.setAAD(Buffer.from(aad, "utf8"));
    decipher.setAuthTag(sealed.tag);
    return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** The last four characters, the only part of a key that is ever shown again. */
export function lastFour(secret: string): string {
  return secret.slice(-4);
}
