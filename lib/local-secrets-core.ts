import { randomBytes } from "node:crypto";

// The secrets a copy that runs on a person's own computer makes for itself on first start (open item ED9), so none is shipped in a download and no two
// copies share one. They are written to one small file beside the data folder (never in the repository, never in the database) and put in the
// environment before the first request. A value already set in the environment wins, so a copy someone configures by hand is left alone.
// No files and no database here: the file work is in lib/local-secrets.ts, the tests use this.

/** The names this file keeps, with how each is made. SESSION_SECRET encrypts the sign-in cookie; CIRCLE_KEY_SECRET is the master key for a circle owner's Claude key. */
export const LOCAL_SECRETS = {
  SESSION_SECRET: () => randomBytes(48).toString("hex"),
  CIRCLE_KEY_SECRET: () => randomBytes(32).toString("hex"),
} as const;

export type SecretName = keyof typeof LOCAL_SECRETS;
export const SECRET_NAMES = Object.keys(LOCAL_SECRETS) as SecretName[];

/** The file for a data folder: beside it, named after it, so two copies in one parent folder never share one. A trailing slash is ignored. */
export function secretsFileFor(dataDir: string): string {
  return `${dataDir.replace(/[\\/]+$/, "")}.secrets.json`;
}

/** Reads the file's text. Values that are not text of a usable length are dropped, so a damaged value is made again instead of used. */
export function parseSecrets(text: string): Partial<Record<SecretName, string>> {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return {};
  }
  const out: Partial<Record<SecretName, string>> = {};
  if (!raw || typeof raw !== "object") return out;
  for (const name of SECRET_NAMES) {
    const v = (raw as Record<string, unknown>)[name];
    if (typeof v === "string" && /^[0-9a-f]{64,}$/.test(v)) out[name] = v;
  }
  return out;
}

/** The names in `have` that the environment does not already set, made fresh for the ones `have` lacks: what to put in the environment, and what is new. */
export function resolveSecrets(
  have: Partial<Record<SecretName, string>>,
  env: Record<string, string | undefined>,
): { values: Partial<Record<SecretName, string>>; made: SecretName[] } {
  const values: Partial<Record<SecretName, string>> = {};
  const made: SecretName[] = [];
  for (const name of SECRET_NAMES) {
    if (env[name]?.trim()) continue;
    if (have[name]) values[name] = have[name];
    else {
      values[name] = LOCAL_SECRETS[name]();
      made.push(name);
    }
  }
  return { values, made };
}
