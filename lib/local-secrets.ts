import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { localDbDir } from "./local-db-core";
import { SECRET_NAMES, parseSecrets, resolveSecrets, secretsFileFor, type SecretName } from "./local-secrets-core";

// Loads (or, the first time, makes and saves) the secrets of a copy that keeps its data in a folder on the computer (DS_DB_DIR), and puts them in
// process.env. Called once at start-up by instrumentation.ts, before the first request needs SESSION_SECRET. A hosted copy has no DS_DB_DIR, so
// this does nothing there. Server code only.

export interface SecretsResult {
  file: string;
  /** Names that were made on this start. */
  made: SecretName[];
  /** Names that came from the environment, so the file was not used for them. */
  fromEnvironment: SecretName[];
}

export function ensureLocalSecrets(env: Record<string, string | undefined> = process.env): SecretsResult | null {
  const dir = localDbDir(env.DS_DB_DIR);
  if (!dir) return null;
  const file = secretsFileFor(dir);
  const have = existsSync(/* turbopackIgnore: true */ file) ? parseSecrets(readFileSync(/* turbopackIgnore: true */ file, "utf8")) : {};
  const { values, made } = resolveSecrets(have, env);
  if (made.length) {
    // The file keeps every secret it has, old and new. Written whole to a temporary name and renamed, so a stop half-way never leaves a short file.
    const all = { version: 1, ...have, ...values };
    mkdirSync(/* turbopackIgnore: true */ dirname(file), { recursive: true });
    const temporary = `${file}.${process.pid}.tmp`;
    writeFileSync(/* turbopackIgnore: true */ temporary, JSON.stringify(all, null, 2), { mode: 0o600 });
    renameSync(/* turbopackIgnore: true */ temporary, file);
  }
  for (const [name, value] of Object.entries(values)) env[name] = value;
  return { file, made, fromEnvironment: SECRET_NAMES.filter((n) => env[n]?.trim() && !(n in values)) };
}
