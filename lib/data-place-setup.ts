import { rmSync } from "node:fs";
import { basename, join } from "node:path";
import { getLocalPool, setLocalPool } from "./db";
import { makeLocalPool, type LocalPool } from "./local-db";
import { secretsFileFor } from "./local-secrets-core";
import { computerDataDir, copyDataFile, currentDataDir, writeWhere } from "./data-place";

// Set-up's "keep my data on this computer" (docs/plan-feathered-edition.md 4.3). A new Feathered copy runs in memory until set-up (lib/local-db.ts), so
// the new account is carried over to a database for the computer's folder, still in memory; set-up then locks it there or makes it a folder. The
// secrets file moves with it (the session secret stays the same), and the note on the drive says where the data is now. Server code only.
export async function keepOnThisComputer(): Promise<LocalPool> {
  const pool = getLocalPool();
  const from = currentDataDir();
  if (!pool || !from) throw new Error("This copy does not keep its data in a folder.");
  const target = computerDataDir();
  const archive = await pool.dump();
  const secrets = basename(secretsFileFor(join(from, "database")));
  copyDataFile(from, target, secrets);
  rmSync(/* turbopackIgnore: true */ join(from, secrets), { force: true });
  process.env.DS_DB_DIR = join(target, "database");
  process.env.ART_DIR = join(target, "pictures");
  const next = makeLocalPool(process.env.DS_DB_DIR, process.env.DS_MIGRATIONS_DIR?.trim() || undefined, true);
  await next.loadIntoMemory(archive);
  setLocalPool(next);
  await pool.end();
  writeWhere(target);
  return next;
}
