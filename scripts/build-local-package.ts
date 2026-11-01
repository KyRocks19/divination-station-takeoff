/**
 * Builds the portable folders of the full local edition (docs/plan-editions.md, step 11; docs/local-edition-setup.md).
 *
 *   npx tsx scripts/build-local-package.ts [--edition winged|feathered] [--target win-x64|linux-x64|linux-arm64|darwin-arm64|darwin-x64|any|all] [--out dist/name] [--skip-build] [--no-node] [--no-archive]
 *     [--host [--circle-max 2..30]]
 *
 * --edition feathered builds the Feathered edition (docs/plan-feathered-edition.md): no AI, no outgoing connections, made to run from a flash drive. Its
 * start file opens a private browser window whose settings stay beside it, and keeps temporary files beside it too. The default is Winged, the full
 * local edition. Each folder carries an upgrade file that moves a copy of the other edition to this one in place (scripts/change-edition.mjs).
 *
 * --host builds a Winged folder that serves its owner's circle (docs/host-guide.md): the same app, with a settings.env that turns host mode on
 * (and sets the circle's size with --circle-max), and JOIN-MY-CIRCLE.md (docs/join-a-circle.md) for the host to send to friends. It is named
 * divination-station-host-<target>. It is for the host alone: friends open the host's address in a browser and download nothing but Tailscale.
 *
 * --target any builds one folder that starts on any of the five kinds of computer (for a flash drive used on more than one): one app, a Node program
 * for each kind in node/<kind>, every kind's picture library, and all three start files, each choosing its own Node program. It is the largest download.
 *
 * It runs `next build` once with DS_STANDALONE=1 (a self-contained server), then, for each target, puts beside it everything a person needs: the
 * migrations and the data files the first start reads, a Node program for that kind of computer (--no-node leaves it out), the picture library
 * (sharp) built for that kind of computer, a start script (start-divination-station.bat on Windows, .sh on Linux, .command on a Mac), the guide, the licence
 * and notice files, a settings example and SHA256SUMS.txt. The Windows folder is also written as a .zip here; the Linux and Mac folders
 * as .tar.gz archives, because a zip cannot mark the Node program and the start script as runnable. A Windows folder built on Mac or Linux gets
 * its node.exe from nodejs.org.
 * The Node programs are downloaded from nodejs.org and checked against its published checksums; the sharp packages come from the npm registry.
 * Nothing from any .env file is copied: a download holds no secret. The person's data lives in my-data beside the app folder, so an update replaces
 * app and nothing else.
 */

import { createHash } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { createReadStream, createWriteStream, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative, resolve } from "node:path";
import { createGzip, deflateRawSync } from "node:zlib";
import type { Writable } from "node:stream";

const root = resolve(__dirname, "..");
const args = process.argv.slice(2);
const flag = (name: string) => args.includes(name);
const value = (name: string) => {
  const i = args.indexOf(name);
  return i >= 0 && args[i + 1] ? args[i + 1] : undefined;
};

const TARGETS = ["win-x64", "linux-x64", "linux-arm64", "darwin-arm64", "darwin-x64"] as const;
type Target = (typeof TARGETS)[number];
const hostTarget = (): Target => {
  const key = `${process.platform === "win32" ? "win" : process.platform}-${process.arch}`;
  const hit = TARGETS.find((t) => t === key);
  if (!hit) throw new Error(`This computer (${key}) is not one of the targets: ${TARGETS.join(", ")}. Pass --target.`);
  return hit;
};

/** A package: one kind of computer, or "any", the folder that starts on every kind. */
type Pack = Target | "any";
const targetArg = value("--target");
const targets: Pack[] = targetArg === "all" ? [...TARGETS] : targetArg ? [targetArg as Pack] : [hostTarget()];
for (const t of targets) if (t !== "any" && !TARGETS.includes(t)) throw new Error(`Unknown target "${t}". Choose from: ${TARGETS.join(", ")}, any, all.`);
/** sharp's name for a kind of computer. */
const sharpName = (t: Target) => (t === "win-x64" ? "win32-x64" : t);
const edition = value("--edition") ?? "winged";
if (edition !== "winged" && edition !== "feathered") throw new Error(`Unknown edition "${edition}". Choose winged or feathered.`);
const feathered = edition === "feathered";
const skipBuild = flag("--skip-build");
const withNode = !flag("--no-node");
const archive = !flag("--no-archive");
const host = flag("--host");
if (host && feathered) throw new Error("--host is for the Winged edition: Feathered serves one person only.");
const circleMax = value("--circle-max");
if (circleMax !== undefined && (!host || !/^\d+$/.test(circleMax) || Number(circleMax) < 2 || Number(circleMax) > 30)) {
  throw new Error("--circle-max goes with --host and is a whole number from 2 to 30.");
}
const cache = join(root, "dist", ".cache");

function git(...a: string[]): string {
  try {
    return execFileSync("git", a, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

const sha256 = (file: string) => createHash("sha256").update(readFileSync(file)).digest("hex");

/** Every file under a folder, as paths relative to it. */
function walk(dir: string, base = dir): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    return statSync(full).isDirectory() ? walk(full, base) : [relative(base, full).replace(/\\/g, "/")];
  });
}

/** The folder inside .next/standalone that holds server.js (it is nested when Next finds a lockfile above the project). */
function findServerDir(standalone: string): string {
  if (existsSync(join(standalone, "server.js"))) return standalone;
  const hit = walk(standalone).find((f) => f.endsWith("/server.js") && !f.includes("node_modules/"));
  if (!hit) throw new Error("server.js was not found in .next/standalone. Did the build set output: standalone (DS_STANDALONE=1)?");
  return join(standalone, hit.slice(0, -"/server.js".length));
}

// ---- the start scripts ----------------------------------------------------------------------------------------------------------------

/** Opens the app in a private window whose settings stay in browser-profile beside the start file, never in the computer's own browser (Feathered). */
const OPEN_PRIVATE_BAT = [
  "@echo off",
  "rem Waits for the app to start, then opens it in a private window. The window keeps its settings in the browser-profile folder beside the start file,",
  "rem so the computer's own browser keeps no history of it. Edge is on every Windows computer; Chrome and Firefox are used when Edge is not found.",
  "setlocal",
  "timeout /t 8 /nobreak >nul",
  'set "PROFILE=%~dp0..\\browser-profile"',
  'set "URL=http://localhost:%PORT%"',
  'if not exist "%PROFILE%" mkdir "%PROFILE%"',
  'set "B=%ProgramFiles(x86)%\\Microsoft\\Edge\\Application\\msedge.exe"',
  'if not exist "%B%" set "B=%ProgramFiles%\\Microsoft\\Edge\\Application\\msedge.exe"',
  'if exist "%B%" start "" "%B%" --user-data-dir="%PROFILE%\\edge" --inprivate --no-first-run --no-default-browser-check "%URL%" & exit /b 0',
  'set "B=%ProgramFiles%\\Google\\Chrome\\Application\\chrome.exe"',
  'if not exist "%B%" set "B=%ProgramFiles(x86)%\\Google\\Chrome\\Application\\chrome.exe"',
  'if not exist "%B%" set "B=%LocalAppData%\\Google\\Chrome\\Application\\chrome.exe"',
  'if exist "%B%" start "" "%B%" --user-data-dir="%PROFILE%\\chrome" --incognito --no-first-run --no-default-browser-check "%URL%" & exit /b 0',
  'set "B=%ProgramFiles%\\Mozilla Firefox\\firefox.exe"',
  'if not exist "%B%" set "B=%ProgramFiles(x86)%\\Mozilla Firefox\\firefox.exe"',
  'if not exist "%PROFILE%\\firefox" mkdir "%PROFILE%\\firefox"',
  'if exist "%B%" start "" "%B%" -no-remote -profile "%PROFILE%\\firefox" -private-window "%URL%" & exit /b 0',
  "echo No browser was found that can open a private window from here. Open a private window yourself and go to %URL%",
  "pause",
  "",
].join("\r\n");

/** The Windows start file. Feathered also keeps temporary files beside it and opens a private window (OPEN_PRIVATE_BAT). */
function bat(feathered: boolean, node = "node\\node.exe"): string {
  return [
  "@echo off",
  "setlocal",
  "rem Starts Divination Station on this computer. Everything you write stays in the my-data folder next to this file.",
  "rem Close this window to stop it. First time: read README.md. Windows may ask once whether to run an unsigned program; see the guide.",
  'cd /d "%~dp0"',
  'set "DS_EDITION=local"',
  ...(feathered
    ? [
        "rem Temporary files stay beside this file too, emptied at each start and stop, so nothing is left on this computer.",
        'if exist "%~dp0temp" rmdir /s /q "%~dp0temp"',
        'mkdir "%~dp0temp"',
        'set "TMP=%~dp0temp"',
        'set "TEMP=%~dp0temp"',
      ]
    : []),
  'set "HOSTNAME=127.0.0.1"',
  'set "PORT=47831"',
  'set "NODE_ENV=production"',
  'set "NEXT_TELEMETRY_DISABLED=1"',
  "rem The app saves its data itself when it is stopped (a locked copy writes its sealed file), so Next.js leaves Ctrl+C to it.",
  'set "NEXT_MANUAL_SIG_HANDLE=1"',
  'set "DS_DATA=%~dp0my-data"',
  'set "DS_DRIVE_DATA=%~dp0my-data"',
  "rem Data kept on a computer instead of beside the app (chosen at the first start, or with Move my data in Settings): my-data\\where.txt holds its folder.",
  'if exist "%~dp0my-data\\where.txt" set /p DS_DATA=<"%~dp0my-data\\where.txt"',
  'if exist "%~dp0my-data\\where.txt" if not exist "%DS_DATA%\\" (',
  "  echo Your data for this copy is kept on another computer, in %DS_DATA%. Start it on that computer.",
  "  echo If that folder was moved, put it back, or change my-data\\where.txt to say where it is now.",
  "  pause",
  "  exit /b 1",
  ")",
  feathered
    ? "rem Optional settings (a different port or data folder): copy settings.example.env to settings.env and edit it."
    : "rem Optional settings (a Claude key, an image program address, a different port or data folder): copy settings.example.env to settings.env and edit it.",
  'if exist "%~dp0settings.env" for /f "usebackq eol=# tokens=1,* delims==" %%a in ("%~dp0settings.env") do if not "%%b"=="" set "%%a=%%b"',
  "rem These come after the settings file, because they follow DS_DATA.",
  'set "DS_DB_DIR=%DS_DATA%\\database"',
  'set "ART_DIR=%DS_DATA%\\pictures"',
  'set "DS_MIGRATIONS_DIR=%~dp0app\\migrations"',
  'set "NODE=%~dp0' + node + '"',
  'if not exist "%NODE%" set "NODE=node"',
  '"%NODE%" --version >nul 2>&1',
  "if errorlevel 1 (",
  "  echo Node.js was not found. This download should include it in the node folder; download it again or install Node.js from https://nodejs.org",
  "  pause",
  "  exit /b 1",
  ")",
  'if not exist "%DS_DATA%" mkdir "%DS_DATA%"',
  "rem Already running (a second double-click): open the one that is running instead of starting another, which would fail.",
  '"%NODE%" -e "fetch(\'http://127.0.0.1:%PORT%/login\').then(()=>process.exit(0),()=>process.exit(1))" >nul 2>&1',
  "if not errorlevel 1 (",
  "  echo Divination Station is already running on this computer, so this window opens it in your browser and closes.",
  feathered ? '  start "" /min "%~dp0app\\open-private-window.bat"' : "  start http://localhost:%PORT%",
  "  timeout /t 5 /nobreak >nul",
  "  exit /b 0",
  ")",
  'echo Starting Divination Station at http://localhost:%PORT% ... the first start takes about half a minute while it sets up your data.',
  feathered ? 'start "" /min "%~dp0app\\open-private-window.bat"' : 'start "" /min cmd /c "timeout /t 8 /nobreak >nul & start http://localhost:%PORT%"',
  'cd /d "%~dp0app"',
  '"%NODE%" server.js',
  ...(feathered ? ['cd /d "%~dp0"', 'if exist "%~dp0temp" rmdir /s /q "%~dp0temp"'] : []),
  "echo.",
  "echo Divination Station has stopped. If this was not on purpose, the lines above say why (the most common one is that another copy is already running).",
  ...(feathered ? ["echo If you are using a flash drive, you can now take it out (on Windows, use Safely remove first)."] : []),
  "pause",
  "",
].join("\r\n");
}

/** The script for Linux (.sh) and for a Mac (.command, which also clears the "downloaded from the internet" mark that blocks an unsigned program). */
/** Opens the app in a private window whose settings stay in browser-profile beside the start file (Feathered, Mac and Linux). */
function openPrivateSh(mac: boolean): string[] {
  const chromium = (bin: string, dir: string, flag: string) => `${bin} --user-data-dir="$P/${dir}" ${flag} --no-first-run --no-default-browser-check "$URL"`;
  return [
    "# Opens the app in a private window whose settings stay in browser-profile beside this file, so the computer's own browser keeps no history of it.",
    "open_private() {",
    '  URL="http://localhost:$PORT"',
    '  P="$HERE/browser-profile"',
    '  mkdir -p "$P/firefox"',
    ...(mac
      ? [
          '  if [ -d "/Applications/Google Chrome.app" ]; then ' + chromium('open -na "Google Chrome" --args', "chrome", "--incognito") + "; return; fi",
          '  if [ -d "/Applications/Microsoft Edge.app" ]; then ' + chromium('open -na "Microsoft Edge" --args', "edge", "--inprivate") + "; return; fi",
          '  if [ -d "/Applications/Firefox.app" ]; then open -na Firefox --args -no-remote -profile "$P/firefox" -private-window "$URL"; return; fi',
        ]
      : [
          "  for b in google-chrome google-chrome-stable chromium chromium-browser; do",
          '    if command -v "$b" >/dev/null 2>&1; then ' + chromium('"$b"', "chrome", "--incognito") + " >/dev/null 2>&1 & return; fi",
          "  done",
          '  if command -v microsoft-edge >/dev/null 2>&1; then ' + chromium("microsoft-edge", "edge", "--inprivate") + " >/dev/null 2>&1 & return; fi",
          '  if command -v firefox >/dev/null 2>&1; then firefox -no-remote -profile "$P/firefox" -private-window "$URL" >/dev/null 2>&1 & return; fi',
        ]),
    '  echo "No browser was found that can open a private window from here. Open a private window yourself and go to $URL"',
    "}",
  ];
}

/** The lines that choose the Node program: the one beside the start file, or in the "any computer" folder the one for this kind of computer. */
function nodeLines(any: boolean): string[] {
  if (!any) return ['NODE="$HERE/node/node"'];
  return [
    'case "$(uname -s)-$(uname -m)" in',
    '  Darwin-arm64) NODE="$HERE/node/darwin-arm64/node" ;;',
    '  Darwin-*) NODE="$HERE/node/darwin-x64/node" ;;',
    '  Linux-aarch64|Linux-arm64) NODE="$HERE/node/linux-arm64/node" ;;',
    '  *) NODE="$HERE/node/linux-x64/node" ;;',
    "esac",
  ];
}

function shellScript(mac: boolean, feathered = false, any = false): string {
  return [
    "#!/bin/sh",
    "# Starts Divination Station on this computer. Everything you write stays in the my-data folder next to this file. Press Ctrl+C to stop.",
    'cd "$(dirname "$0")" || exit 1',
    "HERE=$(pwd)",
    ...(feathered ? openPrivateSh(mac) : []),
    ...(mac ? ['# A file downloaded in a browser is marked as from the internet, and macOS then refuses to run an unsigned program. This removes the mark from this folder.', 'xattr -dr com.apple.quarantine "$HERE" 2>/dev/null'] : []),
    "export DS_EDITION=local",
    ...(feathered
      ? [
          "# Temporary files stay beside this file too, emptied at each start and stop, so nothing is left on this computer.",
          'rm -rf "$HERE/temp"; mkdir -p "$HERE/temp"',
          'export TMPDIR="$HERE/temp"',
        ]
      : []),
    "export HOSTNAME=127.0.0.1",
    "export PORT=47831",
    "export NODE_ENV=production",
    "export NEXT_TELEMETRY_DISABLED=1",
    "export NEXT_MANUAL_SIG_HANDLE=1",
    'export DS_DATA="$HERE/my-data"',
    'export DS_DRIVE_DATA="$HERE/my-data"',
    "# Data kept on a computer instead of beside the app (chosen at the first start, or with Move my data in Settings): my-data/where.txt holds its folder.",
    'if [ -f "$HERE/my-data/where.txt" ]; then',
    '  DS_DATA=$(head -n 1 "$HERE/my-data/where.txt" | tr -d "\\r")',
    '  if [ ! -d "$DS_DATA" ]; then echo "Your data for this copy is kept on another computer, in $DS_DATA. Start it on that computer. If that folder was moved, put it back, or change my-data/where.txt to say where it is now."; exit 1; fi',
    'fi',
    "# Optional settings: copy settings.example.env to settings.env and edit it.",
    'if [ -f "$HERE/settings.env" ]; then set -a; . "$HERE/settings.env"; set +a; fi',
    "# These come after the settings file, because they follow DS_DATA.",
    'export DS_DB_DIR="$DS_DATA/database"',
    'export ART_DIR="$DS_DATA/pictures"',
    'export DS_MIGRATIONS_DIR="$HERE/app/migrations"',
    ...nodeLines(any),
    '[ -x "$NODE" ] || chmod +x "$NODE" 2>/dev/null',
    '[ -x "$NODE" ] || NODE=node',
    '"$NODE" --version >/dev/null 2>&1 || { echo "Node.js was not found. This download should include it in the node folder; download it again or install Node.js from https://nodejs.org"; exit 1; }',
    'mkdir -p "$DS_DATA"',
    "# Already running (a second start): open the one that is running instead of starting another, which would fail.",
    'if "$NODE" -e "fetch(\'http://127.0.0.1:$PORT/login\').then(()=>process.exit(0),()=>process.exit(1))" >/dev/null 2>&1; then',
    '  echo "Divination Station is already running on this computer. Opening it in your browser."',
    ...(feathered ? ["  open_private"] : ['  if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"; fi']),
    '  exit 0',
    'fi',
    'echo "Starting Divination Station at http://localhost:$PORT ... the first start takes about half a minute."',
    ...(feathered
      ? [
          "( sleep 8; open_private ) &",
          '( cd "$HERE/app" && "$NODE" server.js )',
          'rm -rf "$HERE/temp"',
          'echo "Divination Station has stopped. If you are using a flash drive, you can now take it out (eject it first)."',
        ]
      : [
          '( sleep 8; if command -v open >/dev/null 2>&1; then open "http://localhost:$PORT"; elif command -v xdg-open >/dev/null 2>&1; then xdg-open "http://localhost:$PORT"; fi ) >/dev/null 2>&1 &',
          'cd "$HERE/app" && exec "$NODE" server.js',
        ]),
    "",
  ].join("\n");
}

const FEATHERED_SETTINGS_EXAMPLE = [
  "# Copy this file to settings.env (same folder) and take out the # before a line to use it.",
  "# Another port, if 47831 is taken.",
  "# PORT=47831",
  "# Keep your data somewhere else (a path without quotes). On a flash drive, leave this out: your data then stays on the drive.",
  "# DS_DATA=D:\\DivinationStationData",
  "",
].join("\n");

const SETTINGS_EXAMPLE = [
  "# Copy this file to settings.env (same folder) and take out the # before a line to use it. Never share settings.env once it holds a key.",
  "# Your own Claude key, if you want the Claude features. Without it they stay off.",
  "# ANTHROPIC_API_KEY=",
  "# An image program on this computer, for example KoboldCpp with an image model (docs/picture-model-at-home.md).",
  "# IMAGE_GEN_URL=http://localhost:5001",
  "# Another port, if 47831 is taken.",
  "# PORT=47831",
  "# Keep your data somewhere else (a path without quotes).",
  "# DS_DATA=D:\\DivinationStationData",
  "# Host mode: this copy also serves your circle over Tailscale or Headscale. Read HOSTING.md first: you will be able to read what your friends write.",
  "# DS_MODE=host",
  "# The private name your friends reach this computer by, for example my-pc.tail1234.ts.net (several: separate them with commas).",
  "# ALLOWED_HOSTS=",
  "# How many people the circle may hold, from 2 to 30 (10 if not set).",
  "# DS_HOST_CIRCLE_MAX=10",
  "",
].join("\n");

/** settings.env of a --host folder. It holds no secret, so it may travel in the download. */
const HOST_SETTINGS = () =>
  [
    "# This copy serves your circle (HOSTING.md). Everything your friends write is stored on this computer, and you can read it.",
    "# The other settings you can add are in settings.example.env. Never share this file once it holds a key.",
    "DS_MODE=host",
    "# How many people the circle may hold, from 2 to 30.",
    `DS_HOST_CIRCLE_MAX=${circleMax ?? "10"}`,
    "",
  ].join("\n");

// ---- downloads ------------------------------------------------------------------------------------------------------------------------

async function download(url: string): Promise<Buffer> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not download ${url}: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/** Puts the Node program for a Linux or Mac target at `dest`, after checking the download against nodejs.org's published checksum. */
async function fetchNode(target: Target, dest: string): Promise<void> {
  const [os, arch] = target.split("-");
  const v = process.version;
  const name = `node-${v}-${os}-${arch}.tar.gz`;
  mkdirSync(cache, { recursive: true });
  const file = join(cache, name);
  if (!existsSync(file)) {
    const sums = (await download(`https://nodejs.org/dist/${v}/SHASUMS256.txt`)).toString("utf8");
    const line = sums.split("\n").find((l) => l.trim().endsWith(` ${name}`));
    if (!line) throw new Error(`nodejs.org has no checksum for ${name}`);
    const data = await download(`https://nodejs.org/dist/${v}/${name}`);
    const got = createHash("sha256").update(data).digest("hex");
    if (got !== line.trim().split(/\s+/)[0]) throw new Error(`The download of ${name} does not match nodejs.org's checksum. Not used.`);
    writeFileSync(file, data);
  }
  mkdirSync(dest, { recursive: true });
  // Relative names and cwd, because GNU tar reads "C:" in a path as a remote computer.
  execFileSync("tar", ["-xzf", name, "-C", relative(cache, dest).replace(/\\/g, "/"), "--strip-components=2", `node-${v}-${os}-${arch}/bin/node`], { cwd: cache });
}

/** Puts the Windows Node program (node.exe) at `dest`, checked against nodejs.org's published checksum, for a package built on another computer. */
async function fetchWinNode(dest: string): Promise<void> {
  const v = process.version;
  mkdirSync(cache, { recursive: true });
  const file = join(cache, `node-${v}-win-x64.exe`);
  if (!existsSync(file)) {
    const sums = (await download(`https://nodejs.org/dist/${v}/SHASUMS256.txt`)).toString("utf8");
    const line = sums.split("\n").find((l) => l.trim().endsWith(" win-x64/node.exe"));
    if (!line) throw new Error("nodejs.org has no checksum for win-x64/node.exe");
    const data = await download(`https://nodejs.org/dist/${v}/win-x64/node.exe`);
    if (createHash("sha256").update(data).digest("hex") !== line.trim().split(/\s+/)[0]) throw new Error("The download of node.exe does not match nodejs.org's checksum. Not used.");
    writeFileSync(file, data);
  }
  mkdirSync(dest, { recursive: true });
  cpSync(file, join(dest, "node.exe"));
}

/** Swaps the Windows build of sharp (the picture library) in a package for the one for `target`, fetched from the npm registry. */
function swapSharp(app: string, kinds: Target[]): void {
  const sharpPkg = JSON.parse(readFileSync(join(app, "node_modules", "sharp", "package.json"), "utf8")) as { optionalDependencies: Record<string, string> };
  const opt = sharpPkg.optionalDependencies;
  // sharp names its packages @img/sharp-<os>-<arch> and @img/sharp-libvips-<os>-<arch>; the Windows one carries its libvips inside.
  const wanted = kinds.map(sharpName).flatMap((p) => (p.startsWith("win32") ? [`@img/sharp-${p}`] : [`@img/sharp-${p}`, `@img/sharp-libvips-${p}`]));
  for (const n of wanted) if (!opt[n]) throw new Error(`sharp has no package ${n}`);
  const holders = [join(app, "node_modules"), join(app, "node_modules", "next", "node_modules")].filter((d) => existsSync(join(d, "@img")));
  for (const holder of holders) {
    // Every other kind of computer's build goes: the Windows one, and any the building computer added for itself (a Linux build adds the musl one).
    for (const n of readdirSync(join(holder, "@img"))) if (n.startsWith("sharp-") && !wanted.includes(`@img/${n}`)) rmSync(join(holder, "@img", n), { recursive: true });
  }
  mkdirSync(cache, { recursive: true });
  for (const n of wanted) {
    // The building computer's own copy is whole (npm installed it), so it is used when it is the same version; no download needed.
    const own = join(root, "node_modules", n);
    const ownPkg = join(own, "package.json");
    if (existsSync(ownPkg) && (JSON.parse(readFileSync(ownPkg, "utf8")) as { version: string }).version === opt[n]) {
      for (const holder of holders) cpSync(own, join(holder, "@img", n.replace("@img/", "")), { recursive: true, dereference: true });
      continue;
    }
    const spec = `${n}@${opt[n]}`;
    const tgz = join(cache, `${n.replace("@img/", "img-")}-${opt[n]}.tgz`);
    if (!existsSync(tgz)) {
      const packed = execFileSync("npm", ["pack", spec, "--silent", "--pack-destination", cache], { cwd: root, encoding: "utf8", shell: process.platform === "win32" }).trim().split("\n").pop()!;
      const made = join(cache, packed);
      if (made !== tgz) writeFileSync(tgz, readFileSync(made));
    }
    for (const holder of holders) {
      const dest = join(holder, "@img", n.replace("@img/", ""));
      mkdirSync(dest, { recursive: true });
      execFileSync("tar", ["-xzf", relative(cache, tgz).replace(/\\/g, "/"), "-C", relative(cache, dest).replace(/\\/g, "/"), "--strip-components=1"], { cwd: cache });
    }
  }
}

// ---- a tar.gz writer (so the Node program and the start script keep their "runnable" mark) -----------------------------------------------

const BLOCK = 512;
function octal(n: number, width: number): string {
  return n.toString(8).padStart(width - 1, "0") + "\0";
}
function tarHeader(name: string, size: number, mode: number, mtime: number, type: "0" | "5" | "L"): Buffer {
  const h = Buffer.alloc(BLOCK);
  h.write(name.slice(0, 100), 0, "utf8");
  h.write(octal(mode, 8), 100, "ascii");
  h.write(octal(0, 8), 108, "ascii");
  h.write(octal(0, 8), 116, "ascii");
  h.write(octal(size, 12), 124, "ascii");
  h.write(octal(mtime, 12), 136, "ascii");
  h.write("        ", 148, "ascii");
  h.write(type, 156, "ascii");
  h.write("ustar\0" + "00", 257, "ascii");
  h.write("root", 265, "ascii");
  h.write("root", 297, "ascii");
  let sum = 0;
  for (const b of h) sum += b;
  h.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
  return h;
}
async function put(out: Writable, chunk: Buffer): Promise<void> {
  if (!out.write(chunk)) await new Promise<void>((r) => out.once("drain", () => r()));
}
async function putFile(out: Writable, file: string): Promise<void> {
  for await (const chunk of createReadStream(file)) await put(out, chunk as Buffer);
}
async function writeTarGz(dir: string, top: string, outFile: string, isExecutable: (rel: string) => boolean): Promise<void> {
  const gz = createGzip({ level: 9 });
  const sink = createWriteStream(outFile);
  gz.pipe(sink);
  const entries = (d: string): string[] => readdirSync(d).sort().flatMap((n) => {
    const rel = relative(dir, join(d, n)).replace(/\\/g, "/");
    return statSync(join(d, n)).isDirectory() ? [rel + "/", ...entries(join(d, n))] : [rel];
  });
  const fix = (name: string, size: number, mode: number, mtime: number, type: "0" | "5") => {
    const full = `${top}/${name}`;
    const parts: Buffer[] = [];
    if (Buffer.byteLength(full) > 100) {
      const data = Buffer.from(full + "\0", "utf8");
      parts.push(tarHeader("././@LongLink", data.length, 0o644, 0, "L"), data, Buffer.alloc((BLOCK - (data.length % BLOCK)) % BLOCK));
    }
    parts.push(tarHeader(full, size, mode, mtime, type));
    return parts;
  };
  for (const part of fix("", 0, 0o755, 0, "5").slice(0)) await put(gz, part);
  for (const rel of entries(dir)) {
    const full = join(dir, rel);
    const st = statSync(full);
    const mtime = Math.floor(st.mtimeMs / 1000);
    if (rel.endsWith("/")) {
      for (const part of fix(rel, 0, 0o755, mtime, "5")) await put(gz, part);
    } else {
      for (const part of fix(rel, st.size, isExecutable(rel) ? 0o755 : 0o644, mtime, "0")) await put(gz, part);
      await putFile(gz, full);
      await put(gz, Buffer.alloc((BLOCK - (st.size % BLOCK)) % BLOCK));
    }
  }
  await put(gz, Buffer.alloc(BLOCK * 2));
  await new Promise<void>((resolveDone, reject) => {
    sink.on("finish", () => resolveDone());
    sink.on("error", reject);
    gz.end();
  });
}

// ---- a .zip (for the Windows folder) -----------------------------------------------------------------------------------------------------
// A plain zip with every file deflated under one top folder, so the owner need not zip the Windows folder by hand. Below 65,535 files and 4 GB,
// so no zip64. Names are marked UTF-8 (flag bit 11).

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer): number {
  let c = 0xffffffff;
  for (const b of data) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function dosTime(ms: number): { time: number; date: number } {
  const d = new Date(ms);
  return { time: (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1), date: ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate() };
}
async function writeZip(dir: string, top: string, outFile: string): Promise<void> {
  const sink = createWriteStream(outFile);
  const central: Buffer[] = [];
  let offset = 0;
  const files = walk(dir).sort();
  if (files.length >= 0xffff) throw new Error(`Too many files for a plain zip (${files.length}).`);
  for (const rel of files) {
    const full = join(dir, rel);
    const raw = readFileSync(full);
    const packed = deflateRawSync(raw, { level: 9 });
    const name = Buffer.from(`${top}/${rel}`, "utf8");
    const crc = crc32(raw);
    const { time, date } = dosTime(statSync(full).mtimeMs);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(8, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(packed.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    await put(sink, local);
    await put(sink, name);
    await put(sink, packed);
    const entry = Buffer.alloc(46);
    entry.writeUInt32LE(0x02014b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt16LE(20, 6);
    entry.writeUInt16LE(0x0800, 8);
    entry.writeUInt16LE(8, 10);
    entry.writeUInt16LE(time, 12);
    entry.writeUInt16LE(date, 14);
    entry.writeUInt32LE(crc, 16);
    entry.writeUInt32LE(packed.length, 20);
    entry.writeUInt32LE(raw.length, 24);
    entry.writeUInt16LE(name.length, 28);
    entry.writeUInt32LE(offset, 42);
    central.push(entry, name);
    offset += local.length + name.length + packed.length;
    if (offset > 0xffffffff) throw new Error("The zip would be over 4 GB.");
  }
  const dirSize = central.reduce((n, b) => n + b.length, 0);
  for (const b of central) await put(sink, b);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(files.length, 8);
  end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(dirSize, 12);
  end.writeUInt32LE(offset, 16);
  await put(sink, end);
  await new Promise<void>((resolveDone, reject) => {
    sink.on("finish", () => resolveDone());
    sink.on("error", reject);
    sink.end();
  });
}

// ---- the Feathered checks ----------------------------------------------------------------------------------------------------------------

/** Addresses outside this computer that the Feathered build must not contain (docs/plan-feathered-edition.md, section 5, layer 1). */
export const FEATHERED_FORBIDDEN = ["api.anthropic.com", "random.org/integers", "google.com/search", "upstash.io"];
/** Packages that only the AI or the picture studio use, left out of a Feathered folder. */
const FEATHERED_DROPPED_PACKAGES = ["@anthropic-ai", "@google", "ioredis"];

/** Removes the AI packages from a Feathered folder, then refuses to finish if its code still holds an outside address or one of those packages. */
function checkFeathered(app: string): void {
  for (const holder of [join(app, "node_modules"), join(app, "node_modules", "next", "node_modules")]) {
    for (const name of FEATHERED_DROPPED_PACKAGES) rmSync(join(holder, name), { recursive: true, force: true });
  }
  const code = walk(join(app, ".next")).filter((f) => f.endsWith(".js") || f.endsWith(".html") || f.endsWith(".json"));
  const hits: string[] = [];
  for (const f of code) {
    const text = readFileSync(join(app, ".next", f), "utf8");
    for (const bad of FEATHERED_FORBIDDEN) if (text.includes(bad)) hits.push(`${f}: ${bad}`);
  }
  if (hits.length) throw new Error(`The Feathered build holds addresses outside this computer, which must never happen:\n  ${hits.slice(0, 20).join("\n  ")}`);
  const left = FEATHERED_DROPPED_PACKAGES.filter((n) => existsSync(join(app, "node_modules", n)));
  if (left.length) throw new Error(`AI packages are still in the Feathered folder: ${left.join(", ")}`);
}

// ---- one target -----------------------------------------------------------------------------------------------------------------------

async function assemble(target: Pack, serverDir: string, standalone: string, out: string): Promise<void> {
  const any = target === "any";
  const isWin = target === "win-x64";
  if (existsSync(out)) rmSync(out, { recursive: true });
  const app = join(out, "app");
  mkdirSync(app, { recursive: true });

  cpSync(serverDir, app, { recursive: true, dereference: true, filter: (src) => !/[\\/]\.env/.test(src) });
  // Next copies traced node_modules next to server.js when the project is the tracing root; when it is nested they sit at the standalone top.
  if (serverDir !== standalone && existsSync(join(standalone, "node_modules")) && !existsSync(join(app, "node_modules"))) {
    cpSync(join(standalone, "node_modules"), join(app, "node_modules"), { recursive: true, dereference: true });
  }
  // Guard: a file read the build could not follow makes it copy the whole project (tests, dist, the lot) into the server. A turbopackIgnore comment on
  // that read is the fix (see lib/art-store.ts).
  const stray = ["tests", "dist"].filter((d) => existsSync(join(app, d)));
  if (stray.length) throw new Error(`The whole project was copied into the server (${stray.join(", ")} found in app/). Find the file read the build followed: grep the .nft.json files under .next/server for one of them.`);
  mkdirSync(join(app, ".next"), { recursive: true });
  cpSync(join(root, ".next", "static"), join(app, ".next", "static"), { recursive: true });
  cpSync(join(root, "public"), join(app, "public"), { recursive: true });
  cpSync(join(root, "migrations"), join(app, "migrations"), { recursive: true });
  // The first start reads the symbol-archetype files in data/ (lib/local-seed.ts reads them from the folder the server runs in) and, if there, the reference bundle.
  cpSync(join(root, "data"), join(app, "data"), { recursive: true });
  if (!existsSync(join(root, "data", "reference-bundle.json"))) {
    console.warn("WARNING: data/reference-bundle.json is missing, so this copy will start with an empty encyclopedia. Make it with scripts/export-reference-bundle.ts first.");
  }

  // Always, even for Windows on Windows: the build copies only the sharp files code asks for by name, so the .node came without the libvips DLLs it
  // loads, and the server failed to start on a clean PC with "ERR_DLOPEN_FAILED: The specified module could not be found" (2026-10-27).
  swapSharp(app, any ? [...TARGETS] : [target]);

  if (withNode && any) {
    for (const t of TARGETS) {
      if (t === "win-x64") await fetchWinNode(join(out, "node", t));
      else await fetchNode(t, join(out, "node", t));
    }
  } else if (withNode) {
    if (isWin && process.platform !== "win32") {
      // Built on Mac or Linux: the Windows node.exe comes from nodejs.org, checked against its checksum, as for the "any computer" folder.
      await fetchWinNode(join(out, "node"));
    } else if (isWin) {
      mkdirSync(join(out, "node"), { recursive: true });
      cpSync(process.execPath, join(out, "node", "node.exe"));
      const lic = join(resolve(process.execPath, ".."), "LICENSE");
      if (existsSync(lic)) cpSync(lic, join(out, "node", "LICENSE-node.txt"));
    } else {
      await fetchNode(target, join(out, "node"));
    }
  }

  // The upgrade file: moves a copy of the other edition to this one in place, keeping its data (docs/plan-feathered-edition.md 7.1). The update file runs
  // the same script with --update: it brings a copy of this edition to this version in place, keeping its data (UPGRADING.md).
  cpSync(join(root, "scripts", "change-edition.mjs"), join(app, "change-edition.mjs"));
  const upgradeName = feathered ? "switch-a-winged-copy-to-feathered" : "upgrade-a-feathered-copy";
  const helpers: [string, string][] = [[upgradeName, ""], ["update-a-copy", "--update "]];
  if (isWin || any) {
    const exe = any ? "node\\win-x64\\node.exe" : "node\\node.exe";
    writeFileSync(join(out, "start-divination-station.bat"), bat(feathered, exe));
    if (feathered) writeFileSync(join(app, "open-private-window.bat"), OPEN_PRIVATE_BAT);
    for (const [name, flag] of helpers) {
      writeFileSync(join(out, `${name}.bat`), ["@echo off", 'cd /d "%~dp0"', `set "NODE=%~dp0${exe}"`, 'if not exist "%NODE%" set "NODE=node"', `"%NODE%" "%~dp0app\\change-edition.mjs" ${flag}%*`, "pause", ""].join("\r\n"));
    }
  }
  for (const ext of any ? ["command", "sh"] : isWin ? [] : [target.startsWith("darwin") ? "command" : "sh"]) {
    writeFileSync(join(out, `start-divination-station.${ext}`), shellScript(ext === "command", feathered, any));
    for (const [name, flag] of helpers) {
      writeFileSync(join(out, `${name}.${ext}`), ["#!/bin/sh", 'cd "$(dirname "$0")" || exit 1', "HERE=$(pwd)", ...nodeLines(any), '[ -x "$NODE" ] || chmod +x "$NODE" 2>/dev/null', '[ -x "$NODE" ] || NODE=node', `exec "$NODE" "$HERE/app/change-edition.mjs" ${flag}"$@"`, ""].join("\n"));
    }
  }
  writeFileSync(join(out, "settings.example.env"), feathered ? FEATHERED_SETTINGS_EXAMPLE : SETTINGS_EXAMPLE);
  if (host) {
    writeFileSync(join(out, "settings.env"), HOST_SETTINGS());
    const joinNote = join(root, "docs", "join-a-circle.md");
    if (!existsSync(joinNote)) throw new Error("docs/join-a-circle.md is missing.");
    cpSync(joinNote, join(out, "JOIN-MY-CIRCLE.md"));
  }
  const guide = join(root, "docs", feathered ? "feathered-guide.md" : "local-edition-setup.md");
  if (!existsSync(guide)) throw new Error(`${relative(root, guide)} is missing.`);
  cpSync(guide, join(out, "README.md"));
  if (!feathered) {
    const hosting = join(root, "docs", "host-guide.md");
    if (!existsSync(hosting)) throw new Error("docs/host-guide.md is missing.");
    cpSync(hosting, join(out, "HOSTING.md"));
  }
  // How to move to a newer version and keep the data (UPGRADING.md at the top of the source).
  for (const f of ["LICENSE", "NOTICE", "UPGRADING.md"]) if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f));
  const commit = git("rev-parse", "--short", "HEAD");
  // The version comes from package.json, so the person can compare it with the one on the download page (UPGRADING.md, "Which version you have").
  const version = (JSON.parse(readFileSync(join(root, "package.json"), "utf8")) as { version: string }).version;
  writeFileSync(join(out, "VERSION.txt"), `Divination Station ${version}, ${feathered ? "Feathered edition" : "Winged edition (the full local edition)"}${host ? ", set up to host a circle" : ""} (${any ? "any computer: Windows, Mac and Linux" : target})\nBuilt ${new Date().toISOString().slice(0, 10)} from commit ${commit} of the source.\nSource and licence: see LICENSE and NOTICE in this folder.\n`);

  // Guard: no secret may travel in a download.
  const leaked = walk(out).filter((f) => /(^|\/)\.env(\.|$)/.test(f) && !f.endsWith(".example.env"));
  if (leaked.length) throw new Error(`Environment files are in the package, which must never happen: ${leaked.join(", ")}`);
  // Guard: a package for one kind of computer holds the picture library for that kind only.
  const natives = walk(app).filter((f) => f.endsWith(".node"));
  const wrong = any ? [] : natives.filter((f) => /sharp-(win32|linux|darwin)/.test(f) && !f.includes(`sharp-${sharpName(target)}`));
  if (wrong.length) throw new Error(`A picture library for another kind of computer is in the ${target} package: ${wrong.join(", ")}`);
  // Guard: each Windows sharp .node needs the libvips DLLs in its own folder, or Windows cannot load it.
  const noDll = natives.filter((f) => /sharp-win32-[^/]+\.node$/.test(f) && !existsSync(join(app, f, "..", "libvips-42.dll")));
  if (noDll.length) throw new Error(`The picture library is missing its DLLs (libvips-42.dll) beside: ${noDll.join(", ")}`);

  if (feathered) checkFeathered(app);

  const files = walk(out).filter((f) => f !== "SHA256SUMS.txt").sort();
  writeFileSync(join(out, "SHA256SUMS.txt"), files.map((f) => `${sha256(join(out, f))}  ${f}`).join("\n") + "\n");
  const mb = Math.round(files.reduce((n, f) => n + statSync(join(out, f)).size, 0) / 1048576);
  console.log(`Built ${out}\n  ${target}: ${files.length} files, ${mb} MB, commit ${commit}${withNode ? ", with Node" : ", without Node"}`);

  // The "any computer" folder is archived too: its Mac and Linux Node programs need their "runnable" mark.
  if (archive && !isWin) {
    const tgz = `${out}.tar.gz`;
    await writeTarGz(out, feathered ? "divination-station-feathered" : "divination-station", tgz, (rel) => /^node\/([a-z0-9-]+\/)?node$/.test(rel) || rel.endsWith(".sh") || rel.endsWith(".command"));
    console.log(`  archive ${tgz} (${Math.round(statSync(tgz).size / 1048576)} MB, sha256 ${sha256(tgz)})`);
  }
  if (archive && isWin) {
    const zip = `${out}.zip`;
    await writeZip(out, feathered ? "divination-station-feathered" : "divination-station", zip);
    console.log(`  archive ${zip} (${Math.round(statSync(zip).size / 1048576)} MB, sha256 ${sha256(zip)})`);
  }
}

async function main() {
  if (!skipBuild) {
    console.log("Building (this takes a minute)...");
    const next = join(root, "node_modules", "next", "dist", "bin", "next");
    const r = spawnSync(process.execPath, [next, "build"], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        DS_STANDALONE: "1",
        NEXT_TELEMETRY_DISABLED: "1",
        // The Feathered edition is chosen when the app is built (lib/edition.ts). Set either way, so a value left in the shell cannot choose it.
        NEXT_PUBLIC_FEATHERED: feathered ? "1" : "",
        // The build loads every route once, and the sign-in code refuses to load without a secret. This value is for that and is never used to sign anything:
        // a copy makes its own secrets on first start. The build must not see a real database either.
        SESSION_SECRET: "build-only-value-not-a-secret-build-only-value",
        DATABASE_URL: "",
      },
    });
    if (r.status !== 0) throw new Error("next build failed");
  }
  const standalone = join(root, ".next", "standalone");
  if (!existsSync(standalone)) throw new Error(".next/standalone is missing. Run without --skip-build.");
  const serverDir = findServerDir(standalone);
  const explicit = value("--out");
  for (const target of targets) {
    const out = resolve(root, explicit && targets.length === 1 ? explicit : `dist/divination-station-${feathered ? "feathered-" : host ? "host-" : ""}${target}`);
    await assemble(target, serverDir, standalone, out);
  }
  console.log("Next: try the start script, zip or archive the folder, publish the checksum of the file beside the download.");
}

main().catch((err) => {
  console.error("build-local-package FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
