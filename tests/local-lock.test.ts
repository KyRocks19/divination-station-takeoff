// Checks on the one-process rule of a local copy's data folder (open item ED9, slice 4). Run with `npm test`.
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { busyMessage, lockFileFor, lockText, lockVerdict, parseLock } from "../lib/local-lock-core";
import { acquireLock, lockBusyMessage } from "../lib/local-lock";
import { makeLocalPool } from "../lib/local-db";

const root = path.join(__dirname, "..");
const folder = () => path.join(mkdtempSync(path.join(tmpdir(), "lock-")), "data");

test("the lock file sits beside the data folder and is named after it", () => {
  assert.equal(lockFileFor("C:/data/ds"), "C:/data/ds.lock");
  assert.equal(lockFileFor("C:\\data\\ds\\"), "C:\\data\\ds.lock");
});

test("a lock is read back; text that is not a lock is read as nothing", () => {
  const info = { pid: 4242, startedAt: "2026-10-18T20:00:00.000Z" };
  assert.deepEqual(parseLock(lockText(info)), info);
  for (const bad of ["", "garbage", "{}", JSON.stringify({ pid: "1", startedAt: "x" }), JSON.stringify({ pid: -3, startedAt: "x" }), JSON.stringify({ pid: 1.5, startedAt: "x" })]) assert.equal(parseLock(bad), null, bad);
});

test("what an existing lock means: another live process is busy, a gone one or an unreadable one is left over, our own is ours", () => {
  const alive = (pid: number) => pid === 100;
  assert.equal(lockVerdict({ pid: 100, startedAt: "x" }, 1, alive), "busy");
  assert.equal(lockVerdict({ pid: 200, startedAt: "x" }, 1, alive), "left over");
  assert.equal(lockVerdict(null, 1, alive), "left over");
  assert.equal(lockVerdict({ pid: 1, startedAt: "x" }, 1, alive), "ours");
});

test("the message says what is wrong and how to carry on, in plain words", () => {
  const msg = busyMessage({ pid: 4242, startedAt: "2026-10-18T20:00:00.000Z" }, "C:/data/ds.lock");
  assert.match(msg, /already open in another copy of the app \(process 4242, started 2026-10-18 20:00 UTC\)/);
  assert.match(msg, /Close the other one first/);
  assert.match(msg, /delete the file C:\/data\/ds\.lock and start again/);
});

test("the first copy takes the lock, a second in the same process is refused, giving it up frees it, and a lock left by a gone process is taken over", () => {
  const dir = folder();
  const file = lockFileFor(dir);
  const release = acquireLock(dir);
  assert.ok(existsSync(file));
  assert.equal(parseLock(readFileSync(file, "utf8"))?.pid, process.pid);
  assert.throws(() => acquireLock(dir), /already open in another copy/);
  release();
  assert.ok(!existsSync(file), "released: the file is gone");
  release(); // giving it up twice does no harm
  // A process that has finished: its id is not running, so its lock is left over.
  const gone = spawnSync(process.execPath, ["-e", "process.stdout.write(String(process.pid))"], { encoding: "utf8" });
  writeFileSync(file, lockText({ pid: Number(gone.stdout), startedAt: "2026-01-01T00:00:00.000Z" }));
  const again = acquireLock(dir);
  assert.equal(parseLock(readFileSync(file, "utf8"))?.pid, process.pid, "taken over");
  again();
  // An unreadable lock is left over too.
  writeFileSync(file, "garbage");
  acquireLock(dir)();
});

test("a second PROCESS is refused while the first is running, and may start once the first has gone", async () => {
  const dir = folder();
  const file = lockFileFor(dir);
  const script = (code: string) => ["--import", "tsx", "-e", `const { acquireLock } = require(${JSON.stringify(path.join(root, "lib", "local-lock.ts"))}); const dir = ${JSON.stringify(dir)}; ${code}`];
  // The first process takes the lock and stays alive until its stdin closes.
  const holder = spawn(process.execPath, script(`acquireLock(dir); process.stdout.write("held\\n"); process.stdin.resume(); process.stdin.on("end", () => process.exit(0));`), { cwd: root, stdio: ["pipe", "pipe", "inherit"] });
  await new Promise<void>((resolve, reject) => { holder.stdout.once("data", () => resolve()); holder.once("exit", () => reject(new Error("the first process stopped early"))); });
  assert.equal(parseLock(readFileSync(file, "utf8"))?.pid, holder.pid);
  const second = spawnSync(process.execPath, script(`try { acquireLock(dir); console.log("TOOK IT"); } catch (e) { console.log("REFUSED: " + e.message); }`), { cwd: root, encoding: "utf8" });
  assert.match(second.stdout, /REFUSED: This data folder is already open in another copy of the app/, second.stdout + second.stderr);
  assert.equal(parseLock(readFileSync(file, "utf8"))?.pid, holder.pid, "the refused copy did not touch the first one's lock");
  // The first process exits normally: its lock goes with it.
  const exited = new Promise<void>((resolve) => holder.once("exit", () => resolve()));
  holder.stdin.end();
  await exited;
  assert.ok(!existsSync(file), "a normal exit removes the lock");
  const third = spawnSync(process.execPath, script(`acquireLock(dir)(); console.log("TOOK IT");`), { cwd: root, encoding: "utf8" });
  assert.match(third.stdout, /TOOK IT/, third.stdout + third.stderr);
});

test("a real folder: opening takes the lock, a second pool on it is refused before PGlite touches the folder, and ending frees it", async () => {
  const dir = folder();
  const first = makeLocalPool(dir);
  const c = await first.connect();
  c.release();
  assert.ok(existsSync(lockFileFor(dir)));
  const second = makeLocalPool(dir);
  await assert.rejects(() => second.connect(), /already open in another copy/);
  await assert.rejects(() => second.connect(), /already open in another copy/, "and it keeps saying so rather than getting stuck");
  const c2 = await first.connect();
  assert.equal(Number(((await c2.query("SELECT 1 AS n")).rows[0] as { n: number }).n), 1, "the first copy is unharmed");
  c2.release();
  await first.end();
  assert.ok(!existsSync(lockFileFor(dir)));
  const third = makeLocalPool(dir);
  (await third.connect()).release();
  await third.end();
});

test("the lock is taken before the folder is opened", () => {
  const src = readFileSync(path.join(root, "lib", "local-db.ts"), "utf8");
  assert.ok(src.indexOf("acquireLock(dir)") < src.indexOf("mkdirSync(dir"), "locked first");
  assert.ok(src.indexOf("acquireLock(dir)") < src.indexOf("new PGlite("));
});

test("the start-up check names a folder another running copy holds, and passes a free or left-over one, without taking the lock", () => {
  const dir = path.join(mkdtempSync(path.join(tmpdir(), "lock-check-")), "data");
  assert.equal(lockBusyMessage(dir), null, "no lock file");
  writeFileSync(lockFileFor(dir), lockText({ pid: process.ppid, startedAt: new Date().toISOString() }));
  assert.match(lockBusyMessage(dir) ?? "", /already open in another copy/);
  assert.equal(existsSync(lockFileFor(dir)), true, "the check takes nothing away");
  writeFileSync(lockFileFor(dir), lockText({ pid: 2 ** 22 + 7, startedAt: new Date().toISOString() }));
  assert.equal(lockBusyMessage(dir), null, "a lock left by a process that is gone does not stop a start");
  assert.match(readFileSync("instrumentation-node.ts", "utf8"), /lockBusyMessage\(process\.env\.DS_DB_DIR\.trim\(\)\)/);
});
