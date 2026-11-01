// Where the reference data (CSVs, Obsidian notes, the old SQLite file) lives: outside the repo, in a sibling folder.
// SEED_DATA_DIR overrides. The folder was renamed with the app; a machine that still has the old name keeps working.
import { existsSync } from "fs";
import { resolve } from "path";

export function referenceDir(): string {
  if (process.env.SEED_DATA_DIR) return process.env.SEED_DATA_DIR;
  const current = resolve(process.cwd(), "..", "divination-station-reference");
  const previous = resolve(process.cwd(), "..", "crossroads-of-tarot-reference");
  return existsSync(current) || !existsSync(previous) ? current : previous;
}
