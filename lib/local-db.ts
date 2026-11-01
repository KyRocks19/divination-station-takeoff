import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { NewerDataError, applyMigrations, migrationState } from "./migrations";
import { backupName, backupsDirFor, namesToPrune, parseBackupName } from "./local-backup-core";
import { seedSharedData } from "./local-seed";
import { acquireLock } from "./local-lock";
import { Lease, ONE_FILE_NAME, errorText, isFileError, openFailureMessage, pgShaped } from "./local-db-core";
import { makeHeader, newDataKey, openSealed, sealBytes } from "./seal-core";
import {
  SealLockedError,
  adoptKey,
  forgetKey,
  openFilesBeside,
  protectBytes,
  readSealFile,
  removeSealFiles,
  sealFileExists,
  sealFilesBeside,
  sealHeader,
  sealKey,
  writeSealFile,
} from "./seal";

// The full local edition's database (open item ED8/ED9, docs/spike-local-database.md): PGlite, Postgres compiled to WebAssembly, keeping its data in
// a folder on the person's own computer (DS_DB_DIR). lib/db.ts uses this instead of a `pg` Pool when that setting is there. It answers the way a
// `pg` Pool does (connect, query, release), one session at a time, and brings the database up to date with the migrations folder the first time it is
// used. One process may open the folder at a time: the app itself. `dump` and `replace` are the backup and restore (lib/local-backup.ts). Server code only.
//
// A copy whose data is locked (lib/seal.ts, docs/plan-feathered-edition.md 4.2) has no folder: its database is one sealed file, opened into memory with
// the key, and written back, sealed, a few seconds after each change and whenever it is locked or stopped. A new Feathered copy runs in memory until
// set-up decides which of the two it will be (`makeSealed` or `makeFolder`), so nothing is written before the person has chosen.
//
// A drive that cannot hold a database folder (exFAT and FAT32 flash drives on Windows: PGlite fails with EINVAL, open item ED22) gets the same
// arrangement without the lock: the database runs in memory and is saved as one plain file beside the folder (ONE_FILE_NAME), a few seconds after
// each change and whenever the app stops. That happens by itself, and only when the folder never held a finished database.

interface PgliteLike {
  waitReady: Promise<void>;
  exec(sql: string): Promise<unknown>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[]; affectedRows?: number }>;
  dumpDataDir(compression?: "auto" | "gzip" | "none"): Promise<Blob>;
  close(): Promise<void>;
}

/** Where the database is: a folder, the sealed file (opened in memory), one plain file (opened in memory), or only memory (a new Feathered copy before set-up). */
export type LocalMode = "folder" | "sealed" | "file" | "memory";

/** The one plain file a copy on a drive that cannot hold the database folder keeps its database in, beside that folder. */
export const oneFilePathFor = (dbDir: string) => join(/* turbopackIgnore: true */ dirname(dbDir.replace(/[\\/]+$/, "")), ONE_FILE_NAME);

/** Writes the one plain file safely: a temporary name first, and the file it replaces kept as `.previous`. */
function writeOneFile(dbDir: string, bytes: Uint8Array): void {
  const p = oneFilePathFor(dbDir);
  writeFileSync(/* turbopackIgnore: true */ `${p}.tmp`, bytes);
  if (existsSync(/* turbopackIgnore: true */ p)) renameSync(/* turbopackIgnore: true */ p, `${p}.previous`);
  renameSync(/* turbopackIgnore: true */ `${p}.tmp`, p);
}

/** Reads the one plain file, or its previous version when a stop half-way left only that. */
function readOneFile(dbDir: string): Uint8Array {
  const p = oneFilePathFor(dbDir);
  return new Uint8Array(readFileSync(/* turbopackIgnore: true */ existsSync(/* turbopackIgnore: true */ p) ? p : `${p}.previous`));
}

const oneFileExists = (dbDir: string) => existsSync(/* turbopackIgnore: true */ oneFilePathFor(dbDir)) || existsSync(/* turbopackIgnore: true */ `${oneFilePathFor(dbDir)}.previous`);

function removeOneFiles(dbDir: string): void {
  const p = oneFilePathFor(dbDir);
  for (const f of [p, `${p}.previous`, `${p}.tmp`]) rmSync(/* turbopackIgnore: true */ f, { force: true });
}

/** Whether `dir` holds a finished Postgres data directory. PG_VERSION alone is written early, so an opening that failed half-way can leave it behind. */
const holdsFinishedDatabase = (dir: string) => existsSync(/* turbopackIgnore: true */ join(dir, "global", "pg_control"));

/** After a change, a locked copy is saved once nothing has changed for this long, and at the latest this long after the first unsaved change. */
export const SAVE_IDLE_MS = 3_000;
export const SAVE_MAX_MS = 20_000;

/** Statements that change nothing; any other marks a locked copy as needing a save. Counting too many only costs a save. */
const READS = /^\s*(select|show|explain|begin|commit|rollback|set|reset)\b/i;
export const changesData = (sql: string) => !READS.test(sql);

const dumpOf = async (db: PgliteLike) => new Uint8Array(await (await db.dumpDataDir("gzip")).arrayBuffer());

/**
 * Saves the whole folder as a "before-update" backup beside it (the same file a manual backup makes, lib/local-backup.ts), keeps the newest three of
 * that kind, and returns the file's name. Written to a temporary name first, so a stop half-way never leaves a short file that looks like a backup.
 * Sealed when the copy is.
 */
async function backupBeforeUpdate(db: PgliteLike, dir: string, now = new Date()): Promise<string> {
  const folder = backupsDirFor(dir);
  mkdirSync(/* turbopackIgnore: true */ folder, { recursive: true });
  const name = backupName(now, "before-update");
  const bytes = protectBytes(await dumpOf(db));
  const final = join(folder, name);
  writeFileSync(/* turbopackIgnore: true */ `${final}.tmp`, bytes);
  renameSync(/* turbopackIgnore: true */ `${final}.tmp`, final);
  const list = readdirSync(/* turbopackIgnore: true */ folder).flatMap((n) => {
    const p = parseBackupName(n);
    return p ? [{ name: n, kind: p.kind, madeAt: p.madeAt }] : [];
  });
  for (const old of namesToPrune(list.filter((b) => b.kind === "before-update"))) rmSync(/* turbopackIgnore: true */ join(folder, old), { force: true });
  return name;
}

/** Moves a folder that is in the way aside instead of deleting it, so nothing is ever lost by a change of mode. */
function moveAside(dir: string, why: string) {
  if (!existsSync(/* turbopackIgnore: true */ dir)) return;
  if (readdirSync(/* turbopackIgnore: true */ dir).length === 0) return rmSync(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
  renameSync(/* turbopackIgnore: true */ dir, `${dir}.${why}-${Date.now()}`);
}

export type LocalPool = ReturnType<typeof makeLocalPool>;

/** The pool-shaped object lib/db.ts hands to its helpers: `connect()` gives a client with `query` and `release`; `on` and `end` exist so nothing else has to know. */
export function makeLocalPool(dir: string, migrationsDir?: string, startInMemory = process.env.NEXT_PUBLIC_FEATHERED === "1") {
  const lease = new Lease();
  let ready: Promise<PgliteLike> | null = null;
  let mode: LocalMode | null = null;
  // The lock that keeps a second process from opening this folder (lib/local-lock.ts); held from the first opening until `end`.
  let unlock: (() => void) | null = null;
  // A locked (or one-file) copy's unsaved changes (see SAVE_IDLE_MS).
  let dirty = false;
  let firstChange = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;

  /** Which mode the files on disk call for now. */
  function modeOnDisk(): LocalMode {
    if (sealFileExists(dir)) return "sealed";
    // Before the folder: when the one file is there, the folder beside it is what an opening that failed left behind.
    if (oneFileExists(dir)) return "file";
    if (existsSync(/* turbopackIgnore: true */ join(dir, "PG_VERSION"))) return "folder";
    return startInMemory ? "memory" : "folder";
  }

  /** Opens the database in `as` mode, loading `archive` into it first when one is given, and brings it up to date. */
  function open(archive?: Uint8Array, as: LocalMode = modeOnDisk()): Promise<PgliteLike> {
    const opening = (async () => {
      // Before anything touches the folder: a second copy running on it would damage it.
      unlock ??= acquireLock(dir);
      let source = archive;
      if (as === "sealed") {
        const key = sealKey();
        if (!key) throw new SealLockedError();
        source ??= new Uint8Array(openSealed(readSealFile(dir), key));
      } else if (as === "file") {
        source ??= oneFileExists(dir) ? readOneFile(dir) : undefined;
      } else if (as === "folder") {
        mkdirSync(dir, { recursive: true });
      }
      // Loaded here, not at the top of the file, so a hosted copy never loads the WebAssembly files.
      const { PGlite } = await import("@electric-sql/pglite");
      const { unaccent } = await import("@electric-sql/pglite/contrib/unaccent");
      const start = async (where: LocalMode): Promise<PgliteLike> => {
        // A file problem inside PGlite is thrown as an object with only a number (ErrnoError): turn it into a message that says what went wrong and where.
        try {
          const started = new PGlite(where === "folder" ? dir : "memory://", {
            extensions: { unaccent },
            ...(source ? { loadDataDir: new Blob([source as BlobPart]) } : {}),
          }) as unknown as PgliteLike;
          await started.waitReady;
          return started;
        } catch (err) {
          throw new Error(openFailureMessage(where === "folder" ? dir : `the ${where} database`, err), { cause: err });
        }
      };
      const hadDatabase = as === "folder" && holdsFinishedDatabase(dir);
      // Whether the one file has to be written at the end of this opening (a new one, or one this opening turned to).
      let writeFile = as === "file" && !oneFileExists(dir);
      let db: PgliteLike;
      try {
        db = await start(as);
      } catch (err) {
        // Only a folder that never held a finished database, and only for a file problem: data that is there is never set aside for an empty file.
        if (as !== "folder" || hadDatabase || !isFileError((err as { cause?: unknown }).cause)) throw err;
        console.warn(`[local-db] ${(err as Error).message}`);
        try {
          moveAside(dir, "unusable");
        } catch {
          /* still in use, or the drive refuses: the one file is used first from now on (modeOnDisk), so the folder is only in the way */
        }
        as = "file";
        writeFile = true;
        db = await start("file");
        console.warn(`[local-db] This drive cannot hold the database folder, so the database is kept in one file instead: ${oneFilePathFor(dir)}. It is saved a few seconds after each change and when the app stops: stop the app before you take the drive out.`);
      }
      mode = as;
      // An update brings new migrations to data that already has some: keep a copy of the data as it was before they run (ED9).
      const migrations = migrationsDir ?? join(/* turbopackIgnore: true */ process.cwd(), "migrations");
      const state = await migrationState(db, migrations);
      // Data a newer version has brought up to date with a change older versions cannot use: stop before anything is written, and say so in the
      // window the person started (UPGRADING.md). Changes that said older versions can use the data are left alone: this version never reads them.
      if (state.blocking.length) {
        await db.close().catch(() => {});
        const err = new NewerDataError(state.blocking);
        console.error(`\n[local-db] ${err.message}\n`);
        throw err;
      }
      if (state.unknown.length) console.info(`[local-db] this data was last used by a newer version; ${state.unknown.length} of its change(s) are not used by this version: ${state.unknown.join(", ")}`);
      if (state.applied > 0 && state.pending.length > 0 && as !== "memory") {
        const saved = await backupBeforeUpdate(db, dir);
        console.info(`[local-db] ${state.pending.length} new migration(s) to apply; the data as it was is saved as ${saved}`);
      }
      const applied = await applyMigrations(db, migrations, (line) => console.info(`[local-db] ${line}`));
      if (applied.length) console.info(`[local-db] ${applied.length} migration(s) applied to ${as === "folder" ? dir : `the ${as} database`}`);
      // Fills the shared reference data that is missing (archetypes, the tools' links, the encyclopedia if a bundle is there); touches nothing else.
      const seeded = await seedSharedData(db);
      if (seeded.pieces || seeded.concepts) console.info(`[local-db] seeded ${seeded.pieces} piece(s) and ${seeded.concepts} concept(s)`);
      if (seeded.bundle === "unusable") console.warn(`[local-db] the reference bundle could not be used: ${seeded.problems.join(" | ")}`);
      // Migrations and seeding changed a locked copy in memory: write them to the sealed file.
      if (as === "sealed" && (applied.length || seeded.pieces || seeded.concepts)) changed();
      // The one file is written here, not by a timer: `ready` is this very opening, so saveHeld would wait for itself.
      if (as === "file" && (writeFile || applied.length || seeded.pieces || seeded.concepts)) writeOneFile(dir, await dumpOf(db));
      return db;
    })();
    ready = opening;
    // A failed opening is not kept: the next asker tries again instead of getting the same failure for ever.
    opening.catch(() => {
      if (ready !== opening) return;
      ready = null;
      mode = null;
    });
    return opening;
  }

  function current(): Promise<PgliteLike> {
    if (ready) return ready;
    // A locked copy answers "locked" without opening anything, and keeps the lock on its folder so no second copy starts on it meanwhile.
    unlock ??= acquireLock(dir);
    if (sealFileExists(dir) && !sealKey()) return Promise.reject(new SealLockedError());
    return open();
  }

  /** Notes a change to a locked (or one-file) copy and arranges its save. */
  function changed() {
    if (mode !== "sealed" && mode !== "file") return;
    dirty = true;
    const now = Date.now();
    if (!firstChange) firstChange = now;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      void pool.saveNow().catch((err) => console.warn(`[local-db] could not save the ${mode === "file" ? "data file" : "locked data"}: ${errorText(err)}`));
    }, Math.max(0, Math.min(SAVE_IDLE_MS, firstChange + SAVE_MAX_MS - now)));
    timer.unref?.();
  }

  /** Writes a locked copy's database to its sealed file, or a one-file copy's to its file. The caller holds the lease. */
  async function saveHeld(): Promise<boolean> {
    if (mode === "file" && dirty && ready) {
      const db = await ready;
      dirty = false;
      firstChange = 0;
      if (timer) clearTimeout(timer);
      timer = null;
      try {
        writeOneFile(dir, await dumpOf(db));
      } catch (err) {
        dirty = true;
        throw err;
      }
      return true;
    }
    if (mode !== "sealed" || !dirty || !ready) return false;
    const key = sealKey();
    const header = sealHeader();
    if (!key || !header) return false;
    const db = await ready;
    dirty = false;
    firstChange = 0;
    if (timer) clearTimeout(timer);
    timer = null;
    try {
      writeSealFile(dir, sealBytes(header, key, await dumpOf(db)));
    } catch (err) {
      dirty = true;
      throw err;
    }
    return true;
  }

  /** Closes the open database (the caller holds the lease). */
  async function closeHeld() {
    const db = await ready?.catch(() => null);
    await db?.close();
    ready = null;
    mode = null;
  }

  const pool = {
    async connect() {
      const release = await lease.take();
      try {
        const db = await current();
        return {
          query: async (sql: string, params?: unknown[]) => {
            const result = pgShaped(await db.query(sql, params));
            if ((mode === "sealed" || mode === "file") && changesData(sql)) changed();
            return result;
          },
          release: () => release(),
          on() {},
          removeListener() {},
        };
      } catch (err) {
        release();
        throw err;
      }
    },
    on() {},
    async end() {
      const release = await lease.take();
      try {
        await saveHeld().catch((err) => console.warn(`[local-db] could not save the ${mode === "file" ? "data file" : "locked data"}: ${errorText(err)}`));
        await closeHeld();
      } finally {
        release();
      }
      unlock?.();
      unlock = null;
    },

    /** Where the database is now (null before it has been opened, or while the copy is locked). */
    mode: (): LocalMode | null => mode,

    /** True while changes to a locked (or one-file) copy wait to be written. */
    unsaved: () => dirty,

    /** Writes a locked (or one-file) copy's unsaved changes now (at a quick exit, a stop, or on a timer). True when something was written. */
    async saveNow(): Promise<boolean> {
      const release = await lease.take();
      try {
        return await saveHeld();
      } finally {
        release();
      }
    },

    /** Saves a locked copy, closes its database and forgets the key: nothing more opens until the passphrase is typed again. False when the copy is not sealed. */
    async lockNow(): Promise<boolean> {
      const release = await lease.take();
      try {
        if (!sealFileExists(dir)) return false;
        await saveHeld();
        await closeHeld();
        forgetKey();
        return true;
      } finally {
        release();
      }
    },

    /**
     * Turns the lock on: the database becomes one sealed file that `passphrase` (and each of `codes`) opens, the data folder is removed, and the backups
     * and pictures beside it are sealed with the same key. `owner` is the account whose password is the passphrase.
     */
    async makeSealed(passphrase: string, codes: string[], owner: number, artDir: string | null = process.env.ART_DIR?.trim() || null): Promise<void> {
      const release = await lease.take();
      try {
        const db = await current();
        if (mode === "sealed") throw new Error("The data is already locked.");
        const wasFolder = mode === "folder";
        const wasFile = mode === "file";
        const plain = await dumpOf(db);
        const key = newDataKey();
        const header = { ...makeHeader(key, passphrase, codes), u: owner };
        writeSealFile(dir, sealBytes(header, key, plain));
        adoptKey(key, header);
        await closeHeld();
        // Only a folder that holds a Postgres data directory is ever emptied here; the sealed file has everything in it now.
        if (wasFolder && existsSync(/* turbopackIgnore: true */ join(dir, "PG_VERSION"))) rmSync(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
        // The plain file would otherwise keep an unlocked copy of everything beside the sealed one.
        if (wasFile) removeOneFiles(dir);
        dirty = false;
        await open(plain, "sealed");
        sealFilesBeside(dir, artDir, key, header);
      } finally {
        release();
      }
    },

    /** Turns the lock off (or keeps a new copy's data in a folder): the database becomes an ordinary folder again, with plain backups and pictures beside it. */
    async makeFolder(artDir: string | null = process.env.ART_DIR?.trim() || null): Promise<void> {
      const release = await lease.take();
      try {
        const db = await current();
        if (mode === "folder") return;
        const plain = await dumpOf(db);
        const key = sealKey();
        await closeHeld();
        moveAside(dir, "before-unlock");
        // On a drive that cannot hold the folder this becomes the one file instead (see the top of this file).
        await open(plain, "folder");
        if ((mode as LocalMode | null) === "folder") removeOneFiles(dir);
        if (key) openFilesBeside(dir, artDir, key);
        removeSealFiles(dir);
        forgetKey();
        dirty = false;
      } finally {
        release();
      }
    },

    /** Loads `archive` into memory as this copy's database (set-up moving a new copy's data to its chosen folder, before it is locked or saved). */
    async loadIntoMemory(archive: Uint8Array): Promise<void> {
      const release = await lease.take();
      try {
        await closeHeld();
        await open(archive, "memory");
      } finally {
        release();
      }
    },

    /** The whole data folder as one gzip archive, taken while nothing else is using the database. */
    async dump(): Promise<Uint8Array> {
      const release = await lease.take();
      try {
        return await dumpOf(await current());
      } finally {
        release();
      }
    },

    /**
     * Replaces everything with the data in `archive`. First the current data is handed to `saveBefore` (which keeps it somewhere), so a restore can
     * always be undone; if that fails nothing is touched. If the archive cannot be opened, the saved copy is put back and the error says so.
     */
    async replace(archive: Uint8Array, saveBefore: (current: Uint8Array) => Promise<void>): Promise<void> {
      const release = await lease.take();
      try {
        const db = await current();
        const as = mode!;
        const before = await dumpOf(db);
        await saveBefore(before);
        // Only a folder that holds a Postgres data directory is ever emptied here; a wrong DS_DB_DIR must not turn a restore into a deletion.
        if (as === "folder" && !existsSync(/* turbopackIgnore: true */ join(dir, "PG_VERSION"))) throw new Error("The data folder is not a database folder, so nothing was changed.");
        await closeHeld();
        if (as === "folder") rmSync(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
        let next: PgliteLike | null = null;
        try {
          next = await open(archive, as);
          // A file that is not a backup of this app has no accounts table; better to find that out now.
          await next.query("SELECT 1 FROM users LIMIT 1");
        } catch (err) {
          await next?.close().catch(() => {});
          ready = null;
          if (as === "folder") rmSync(/* turbopackIgnore: true */ dir, { recursive: true, force: true });
          await open(before, as);
          throw new Error(`That backup could not be opened, so nothing was changed (${errorText(err)}).`);
        }
        if (as === "sealed" || mode === "file") {
          dirty = true;
          await saveHeld();
        }
      } finally {
        release();
      }
    },
  };
  return pool;
}
