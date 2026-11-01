import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { localDbDir } from "./local-db-core";
import { EMPTY_HOST_NAMES, hostNamesFileFor, parseHostNames, type HostNamesFile } from "./host-names-core";

// Reads and writes the names file of a leader's copy (open item H2.2; the rules are in lib/host-names-core.ts). The proxy reads it on every request
// through a short cache, so a name added on the /host page works within a few seconds and without a restart. Server code only.

const CACHE_MS = 3000;
let cached: { at: number; file: string; value: HostNamesFile } | null = null;

function fileName(): string | null {
  const dir = localDbDir();
  return dir ? hostNamesFileFor(dir) : null;
}

/** The names file as it is now, or empty on a copy without a data folder or without the file. Never throws. */
export function readHostNames(now = Date.now()): HostNamesFile {
  const file = fileName();
  if (!file) return EMPTY_HOST_NAMES;
  if (cached && cached.file === file && now - cached.at < CACHE_MS) return cached.value;
  let value = EMPTY_HOST_NAMES;
  try {
    if (existsSync(/* turbopackIgnore: true */ file)) value = parseHostNames(readFileSync(/* turbopackIgnore: true */ file, "utf8"));
  } catch {
    value = EMPTY_HOST_NAMES;
  }
  cached = { at: now, file, value };
  return value;
}

/** Saves the names file whole (temporary name, then rename) and refreshes the cache. */
export function writeHostNames(value: HostNamesFile): void {
  const file = fileName();
  if (!file) throw new Error("This copy does not keep its data in a folder.");
  mkdirSync(/* turbopackIgnore: true */ dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.tmp`;
  writeFileSync(/* turbopackIgnore: true */ temporary, JSON.stringify(value, null, 2), { mode: 0o600 });
  renameSync(/* turbopackIgnore: true */ temporary, file);
  cached = { at: Date.now(), file, value };
}
