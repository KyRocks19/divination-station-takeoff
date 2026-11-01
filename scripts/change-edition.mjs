// Moves an unzipped copy of Divination Station to the edition this file came with, in place (docs/plan-feathered-edition.md 7.1): Feathered to Winged
// (the upgrade), or Winged to Feathered (going back). With --update it instead brings a copy of the same edition to this folder's version, in place
// (UPGRADING.md), and refuses a copy of the other edition. It is copied into each portable folder by scripts/build-local-package.ts as
// app/change-edition.mjs, and the folder's upgrade and update start files run it with the folder's own Node program.
//
//   node app/change-edition.mjs [path of the copy to change] [--update] [--yes]
//
// Either way it refuses to put an older version over a newer one (VERSION.txt names the version), because the older app cannot open data the newer
// one has brought up to date (lib/migrations.ts, NewerDataError).
//
// What it does, in order: checks that the path is a copy of Divination Station and that it is not running; keeps a copy of its my-data folder beside it
// (my-data.before-<edition>-<date>); then replaces the app, the Node program, the start files and the guides with this folder's, and leaves my-data and
// settings.env as they were. Both editions keep their data the same way, so the next start opens it, after any new migrations (with a backup first, as an
// update always does). Plain Node, no packages.

import { cpSync, existsSync, readFileSync, readdirSync, renameSync, rmSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { fileURLToPath } from "node:url";

const here = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const yes = args.includes("--yes");
const update = args.includes("--update");
const given = args.find((a) => !a.startsWith("--"));

/** Which edition a folder holds, from its VERSION.txt (written by the packaging), or null when it is not a copy of the app. */
export function editionOfFolder(folder) {
  const version = join(folder, "VERSION.txt");
  if (!existsSync(join(folder, "app", "server.js")) || !existsSync(version)) return null;
  return /Feathered edition/i.test(readFileSync(version, "utf8")) ? "Feathered" : "Winged";
}

/** The version a folder's VERSION.txt names ("Divination Station 0.2.0, ..."), or null for a folder built before VERSION.txt carried one. */
export function versionOfFolder(folder) {
  const version = join(folder, "VERSION.txt");
  if (!existsSync(version)) return null;
  return /^Divination Station (\d+\.\d+\.\d+)\b/.exec(readFileSync(version, "utf8"))?.[1] ?? null;
}

/** Below 0 when version a is older than b, 0 when they are the same, above 0 when a is newer. */
export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** The port the copy runs on: its settings.env's PORT, or the usual one. */
function portOf(folder) {
  const settings = join(folder, "settings.env");
  if (existsSync(settings)) {
    const m = readFileSync(settings, "utf8").match(/^\s*PORT\s*=\s*(\d{2,5})\s*$/m);
    if (m) return Number(m[1]);
  }
  return 47831;
}

/** True when a process holds the copy's data folder (lib/local-lock-core.ts writes {"pid":…} beside the database) and that process is alive. */
function lockedByLiveProcess(folder) {
  const lock = join(folder, "my-data", "database.lock");
  if (!existsSync(lock)) return false;
  try {
    const { pid } = JSON.parse(readFileSync(lock, "utf8"));
    if (!Number.isInteger(pid) || pid <= 0) return false;
    process.kill(pid, 0);
    return true;
  } catch (err) {
    // EPERM: the process is alive but belongs to someone else. Anything else (ESRCH, a damaged file): a lock left over from a stop.
    return err && err.code === "EPERM";
  }
}

async function running(folder, port) {
  if (lockedByLiveProcess(folder)) return true;
  try {
    await fetch(`http://127.0.0.1:${port}/login`, { signal: AbortSignal.timeout(2000) });
    return true;
  } catch {
    return false;
  }
}

/** The files and folders that belong to an edition, not to the person: everything at the top of the folder except their data and settings. */
function editionEntries(folder) {
  return readdirSync(folder).filter((n) => n !== "my-data" && !n.startsWith("my-data.") && n !== "settings.env" && n !== "browser-profile" && n !== "temp" && n !== ".changing-edition");
}

async function main() {
  const to = editionOfFolder(here);
  if (!to) throw new Error("This file must be run from inside an unzipped copy of Divination Station (the folder that has app and VERSION.txt).");
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const ask = update ? `The folder of the copy to update (for example E:\\divination-station): ` : `The folder of the copy to move to ${to} (for example E:\\divination-station): `;
    const target = resolve(given ?? (await rl.question(ask)).trim().replace(/^"|"$/g, ""));
    if (target === here) throw new Error("That is this folder. Give the path of the other copy, the one to change.");
    const from = editionOfFolder(target);
    if (!from) throw new Error(`${target} is not a copy of Divination Station (it has no app folder or no VERSION.txt).`);
    if (update && from !== to) {
      const other = to === "Winged" ? "upgrade-a-feathered-copy" : "switch-a-winged-copy-to-feathered";
      throw new Error(`${target} holds the ${from} edition, and this download is the ${to} edition. To update it, run the update file of a ${from} download. To change it to ${to}, run ${other} instead.`);
    }
    const newVersion = versionOfFolder(here);
    const oldVersion = versionOfFolder(target);
    if (newVersion && oldVersion && compareVersions(newVersion, oldVersion) < 0) {
      throw new Error(`${target} has version ${oldVersion}, which is newer than this download (${newVersion}). An older version cannot open data a newer one has used. To go back to an older version, see "Going back to an older version" in UPGRADING.md.`);
    }
    if (update && newVersion && oldVersion && compareVersions(newVersion, oldVersion) === 0) {
      console.log(`\n${target} already has version ${newVersion}. Nothing was changed.`);
      return;
    }
    if (await running(target, portOf(target))) throw new Error("That copy is running. Close its window first, then run this again. If you are sure it is closed, delete my-data/database.lock in it and try again.");

    if (update) {
      console.log(`\n${target} has version ${oldVersion ?? "(not named in its VERSION.txt)"}. It will be updated to version ${newVersion ?? "(not named)"}.`);
      console.log("Make a backup first if you have not (Settings, Backups, Back up now), and copy it somewhere off this computer or drive.");
    } else if (to === "Winged") {
      console.log("After this, the copy can reach the internet, but only for an AI feature you turn on yourself. It is no longer the edition that connects to nothing.");
    } else {
      console.log("After this, the AI features, circles and passkeys are gone from the copy. What the AI wrote stays in your data, hidden, and comes back if you move to Winged again.");
    }
    console.log("Your my-data folder and settings.env stay. A copy of my-data is kept beside it first.");
    if (!yes && !/^y(es)?$/i.test((await rl.question("Go ahead? Type yes: ")).trim())) {
      console.log("Nothing was changed.");
      return;
    }

    const data = join(target, "my-data");
    if (existsSync(data)) {
      const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 13);
      const keep = join(target, `my-data.before-${update ? `update-${oldVersion ?? "older"}` : to.toLowerCase()}-${stamp}`);
      cpSync(data, keep, { recursive: true });
      console.log(`Kept a copy of your data: ${keep}`);
    }
    // The new files are copied in beside the old ones first, so a full drive or a pulled-out drive stops this before anything old is removed.
    const staging = join(target, ".changing-edition");
    rmSync(staging, { recursive: true, force: true });
    for (const name of editionEntries(here)) cpSync(join(here, name), join(staging, name), { recursive: true });
    for (const name of editionEntries(target)) if (name !== ".changing-edition") rmSync(join(target, name), { recursive: true, force: true });
    for (const name of readdirSync(staging)) renameSync(join(staging, name), join(target, name));
    rmSync(staging, { recursive: true, force: true });
    if (update) console.log(`\nDone. ${target} now has ${newVersion ? `version ${newVersion}` : "the version of this download"}. Start it with its start file as before; the first start brings your data up to date.`);
    else console.log(`\nDone. ${target} is now the ${to} edition. Start it with its start file as before.`);
  } finally {
    rl.close();
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(`\nNothing more was changed: ${err instanceof Error ? err.message : err}`);
    process.exitCode = 1;
  });
}
