import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

// The sealed data file's format (docs/plan-feathered-edition.md 4.2): the whole database, encrypted, in one file, so a lost flash drive or a shared
// computer shows nothing of the person's writing. No database and no files here, so the tests can run every rule. Server code only (node:crypto).
//
// One random data key encrypts the database (AES-256-GCM). The data key itself is kept in the file's header, wrapped (encrypted) once with a key made
// from the passphrase, and once with a key made from each recovery code, each with scrypt and a salt of its own. So a passphrase change, or a new set of
// recovery codes, rewrites only the header's wraps; and a recovery code can open the data when the passphrase is forgotten. Nobody else can: there is no
// other way in, by design.
//
//   "DSSEAL1\n" | header length (4 bytes, big-endian) | header (JSON) | body: iv (12) | tag (16) | ciphertext
//
// Pictures kept as files are encrypted with the same data key, each in a small format of its own ("DSART1\n" | iv | tag | ciphertext).

export const SEAL_MAGIC = Buffer.from("DSSEAL1\n", "utf8");
export const ART_MAGIC = Buffer.from("DSART1\n", "utf8");

/** scrypt's cost: about a tenth of a second and 32 MB on an ordinary computer, for each try at a passphrase. */
export const KDF = { N: 2 ** 15, r: 8, p: 1 } as const;
const MAXMEM = 64 * 1024 * 1024;

export interface Wrap {
  kind: "pass" | "code";
  salt: string;
  iv: string;
  tag: string;
  key: string;
}

export interface SealHeader {
  v: 1;
  kdf: { N: number; r: number; p: number };
  wraps: Wrap[];
  /** The id of the account whose password is the passphrase: only that account's password change rewraps it. */
  u?: number;
}

/** The same passphrase however it was typed: Unicode letters in one form. Spaces are kept; they are part of a passphrase. */
export const normalizePassphrase = (p: string): string => p.normalize("NFC");

/** A recovery code as the person may type it (lower case, spaces, dashes): letters and numbers only, upper case. */
export const normalizeCodeForKey = (c: string): string => c.toUpperCase().replace(/[^A-Z0-9]/g, "");

function kek(secret: string, salt: Buffer, kdf: SealHeader["kdf"]): Buffer {
  return scryptSync(secret, salt, 32, { N: kdf.N, r: kdf.r, p: kdf.p, maxmem: MAXMEM });
}

function encrypt(key: Buffer, plain: Uint8Array, aad: Buffer): { iv: Buffer; tag: Buffer; data: Buffer } {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  c.setAAD(aad);
  const data = Buffer.concat([c.update(plain), c.final()]);
  return { iv, tag: c.getAuthTag(), data };
}

/** Decrypts, or throws when the key is wrong or a single byte was changed (GCM checks both). */
function decrypt(key: Buffer, iv: Buffer, tag: Buffer, data: Buffer, aad: Buffer): Buffer {
  const d = createDecipheriv("aes-256-gcm", key, iv);
  d.setAAD(aad);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data), d.final()]);
}

const WRAP_AAD = Buffer.from("DSSEAL1 key", "utf8");

/** A new random data key. */
export const newDataKey = (): Buffer => randomBytes(32);

/** The data key, wrapped with a key made from `secret`. */
export function wrapKey(dataKey: Buffer, secret: string, kind: Wrap["kind"], kdf: SealHeader["kdf"] = KDF): Wrap {
  const salt = randomBytes(16);
  const { iv, tag, data } = encrypt(kek(kind === "pass" ? normalizePassphrase(secret) : normalizeCodeForKey(secret), salt, kdf), dataKey, WRAP_AAD);
  return { kind, salt: salt.toString("base64"), iv: iv.toString("base64"), tag: tag.toString("base64"), key: data.toString("base64") };
}

/** The data key, when `secret` opens one of the header's wraps of this kind; otherwise null. */
export function unwrapKey(header: SealHeader, secret: string, kind: Wrap["kind"]): Buffer | null {
  const typed = kind === "pass" ? normalizePassphrase(secret) : normalizeCodeForKey(secret);
  if (!typed) return null;
  for (const w of header.wraps) {
    if (w.kind !== kind) continue;
    try {
      const key = decrypt(kek(typed, Buffer.from(w.salt, "base64"), header.kdf), Buffer.from(w.iv, "base64"), Buffer.from(w.tag, "base64"), Buffer.from(w.key, "base64"), WRAP_AAD);
      if (key.length === 32) return key;
    } catch {
      // Not this one.
    }
  }
  return null;
}

/** A header whose data key opens with `passphrase` (and with each recovery code given). */
export function makeHeader(dataKey: Buffer, passphrase: string, codes: string[] = [], kdf: SealHeader["kdf"] = KDF): SealHeader {
  return { v: 1, kdf: { ...kdf }, wraps: [wrapKey(dataKey, passphrase, "pass", kdf), ...codes.map((c) => wrapKey(dataKey, c, "code", kdf))] };
}

/** The same header with its passphrase wrap replaced (after a password change). */
export function withPassphrase(header: SealHeader, dataKey: Buffer, passphrase: string): SealHeader {
  return { ...header, wraps: [wrapKey(dataKey, passphrase, "pass", header.kdf), ...header.wraps.filter((w) => w.kind !== "pass")] };
}

/** The same header with its recovery-code wraps replaced (after a new set of codes is made). */
export function withCodes(header: SealHeader, dataKey: Buffer, codes: string[]): SealHeader {
  return { ...header, wraps: [...header.wraps.filter((w) => w.kind !== "code"), ...codes.map((c) => wrapKey(dataKey, c, "code", header.kdf))] };
}

/** The whole sealed file for `plain` (the database dump). */
export function sealBytes(header: SealHeader, dataKey: Buffer, plain: Uint8Array): Buffer {
  const head = Buffer.from(JSON.stringify(header), "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(head.length);
  const { iv, tag, data } = encrypt(dataKey, plain, SEAL_MAGIC);
  return Buffer.concat([SEAL_MAGIC, len, head, iv, tag, data]);
}

/** True when the bytes start like a sealed file. */
export const isSealed = (bytes: Uint8Array): boolean => bytes.length > SEAL_MAGIC.length + 4 && timingSafeEqual(Buffer.from(bytes.subarray(0, SEAL_MAGIC.length)), SEAL_MAGIC);

/** The header of a sealed file, without opening its body. Throws on a file that is not one. */
export function readHeader(bytes: Uint8Array): SealHeader {
  if (!isSealed(bytes)) throw new Error("This is not a sealed data file.");
  const buf = Buffer.from(bytes);
  const len = buf.readUInt32BE(SEAL_MAGIC.length);
  const start = SEAL_MAGIC.length + 4;
  if (len > 1_000_000 || start + len + 28 > buf.length) throw new Error("The sealed data file is damaged.");
  const header = JSON.parse(buf.subarray(start, start + len).toString("utf8")) as SealHeader;
  if (header?.v !== 1 || !Array.isArray(header.wraps) || !header.kdf) throw new Error("The sealed data file is from a newer version of the app, or damaged.");
  return header;
}

/** The same sealed file with another header (a new passphrase or new codes): the body is not touched, so no key is needed for it. */
export function replaceHeader(bytes: Uint8Array, header: SealHeader): Buffer {
  const buf = Buffer.from(bytes);
  readHeader(buf);
  const at = SEAL_MAGIC.length + 4 + buf.readUInt32BE(SEAL_MAGIC.length);
  const head = Buffer.from(JSON.stringify(header), "utf8");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(head.length);
  return Buffer.concat([SEAL_MAGIC, len, head, buf.subarray(at)]);
}

/** The body of a sealed file, opened with the data key. Throws on a wrong key or a changed byte. */
export function openSealed(bytes: Uint8Array, dataKey: Buffer): Buffer {
  const buf = Buffer.from(bytes);
  const len = buf.readUInt32BE(SEAL_MAGIC.length);
  const at = SEAL_MAGIC.length + 4 + len;
  return decrypt(dataKey, buf.subarray(at, at + 12), buf.subarray(at + 12, at + 28), buf.subarray(at + 28), SEAL_MAGIC);
}

/** A picture file's bytes, encrypted with the data key. */
export function sealArt(dataKey: Buffer, plain: Uint8Array): Buffer {
  const { iv, tag, data } = encrypt(dataKey, plain, ART_MAGIC);
  return Buffer.concat([ART_MAGIC, iv, tag, data]);
}

export const isSealedArt = (bytes: Uint8Array): boolean =>
  bytes.length > ART_MAGIC.length + 28 && Buffer.from(bytes.subarray(0, ART_MAGIC.length)).equals(ART_MAGIC);

/** A picture file's bytes: opened when sealed (throws on a wrong key), as they are otherwise. */
export function openArt(dataKey: Buffer | null, bytes: Buffer): Buffer {
  if (!isSealedArt(bytes)) return bytes;
  if (!dataKey) throw new Error("The data is locked.");
  const at = ART_MAGIC.length;
  return decrypt(dataKey, bytes.subarray(at, at + 12), bytes.subarray(at + 12, at + 28), bytes.subarray(at + 28), ART_MAGIC);
}
