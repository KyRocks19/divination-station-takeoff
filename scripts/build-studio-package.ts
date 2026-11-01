/**
 * Builds the downloadable Picture Studio for people who lend their computer to a circle (docs/plan-editions.md, step 7; ED7).
 *
 *   npx tsx scripts/build-studio-package.ts [--out dist/picture-studio]
 *
 * It bundles scripts/image-worker.ts and the few files it needs into one file (studio.mjs), so the person who runs it does not need the app's
 * folder or its database code, and puts beside it: a package.json (the one library that cannot be bundled, sharp), start and test scripts for
 * Windows and for Mac or Linux, an example settings file, the guide, the licence and notice files, and SHA256SUMS.txt. The folder is then zipped
 * by the owner (Windows: right-click the folder, Send to, Compressed folder) and the checksum of the zip is published beside the download.
 *
 * It refuses to finish if the bundle contains database code (the studio must never hold or need the database password).
 * esbuild comes with tsx, which the project already uses; it is not a separate dependency of the app.
 */

import { build } from "esbuild";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(__dirname, "..");
const argOut = process.argv.indexOf("--out");
const out = resolve(root, argOut >= 0 && process.argv[argOut + 1] ? process.argv[argOut + 1] : "dist/picture-studio");

function sha256(file: string): string {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

function git(...args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

async function main() {
  if (existsSync(out)) rmSync(out, { recursive: true });
  mkdirSync(out, { recursive: true });

  const result = await build({
    entryPoints: [join(root, "scripts/image-worker.ts")],
    outfile: join(out, "studio.mjs"),
    bundle: true,
    platform: "node",
    format: "esm",
    target: "node20",
    // sharp ships a program for each kind of computer, so it is installed by npm on the lender's computer rather than bundled.
    external: ["sharp"],
    // Bundled code from older libraries may use require(); give it one.
    banner: { js: 'import { createRequire as __cr } from "node:module"; const require = __cr(import.meta.url);' },
    metafile: true,
    legalComments: "inline",
    logLevel: "warning",
  });

  // Guard: nothing that reads the database may be inside the studio.
  const inputs = Object.keys(result.metafile.inputs);
  const bad = inputs.filter((f) => /(^|\/)lib\/db\.ts$/.test(f.replace(/\\/g, "/")) || /node_modules\/pg(\/|-)/.test(f.replace(/\\/g, "/")));
  if (bad.length) throw new Error(`The studio bundle contains database code, which it must never have: ${bad.join(", ")}`);

  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const commit = git("rev-parse", "--short", "HEAD");
  const built = new Date().toISOString().slice(0, 10);
  writeFileSync(
    join(out, "package.json"),
    JSON.stringify(
      {
        name: "divination-station-picture-studio",
        version: `0.0.0+${commit}`,
        private: true,
        license: "AGPL-3.0-only",
        description: "The Picture Studio for Divination Station: makes the pictures that people in a circle ask for, on your own computer.",
        engines: { node: ">=20" },
        scripts: { start: "node studio.mjs", check: "node studio.mjs --check" },
        dependencies: { sharp: pkg.dependencies.sharp },
      },
      null,
      2
    ) + "\n"
  );

  writeFileSync(
    join(out, "start-picture-studio.cmd"),
    [
      "@echo off",
      "rem Starts the picture studio. Start your image program (KoboldCpp) first. Close this window, or press Ctrl+C, to stop.",
      "rem The first time: copy .env.example to .env.local, fill it in, then run check-picture-studio.cmd. See README.md.",
      'cd /d "%~dp0"',
      "node studio.mjs",
      "pause",
      "",
    ].join("\r\n")
  );
  writeFileSync(
    join(out, "check-picture-studio.cmd"),
    [
      "@echo off",
      "rem Tests the settings, the website and the image program. It changes nothing and makes no picture unless you add --picture.",
      'cd /d "%~dp0"',
      "node studio.mjs --check --picture",
      "pause",
      "",
    ].join("\r\n")
  );
  writeFileSync(join(out, "start-picture-studio.sh"), '#!/bin/sh\n# Starts the picture studio. Start your image program (KoboldCpp) first. See README.md.\ncd "$(dirname "$0")" && node studio.mjs\n');
  writeFileSync(join(out, "check-picture-studio.sh"), '#!/bin/sh\n# Tests the settings, the website and the image program (and makes one test picture). See README.md.\ncd "$(dirname "$0")" && node studio.mjs --check --picture\n');
  writeFileSync(
    join(out, ".env.example"),
    [
      "# Copy this file to .env.local (same folder) and fill in the three lines. Never share this file once it holds your token.",
      "# The website's address, as you type it in your browser (https://...).",
      "APP_URL=",
      "# The token from the website (it starts with dsw_). It can only take waiting pictures and send them back.",
      "WORKER_TOKEN=",
      "# Where your image program (KoboldCpp) listens on this computer.",
      "IMAGE_GEN_URL=http://localhost:5001",
      "# Only if your image program is ComfyUI (it usually listens on http://localhost:8188): the next two lines, without the # at the start.",
      "# IMAGE_GEN_KIND=comfyui",
      "# IMAGE_GEN_MODEL=the-model-file-in-its-models-checkpoints-folder.safetensors",
      "# Only for an SDXL model: pictures at its own size. Better pictures, but slower. See README.md.",
      "# IMAGE_GEN_SIZE=sdxl",
      "",
    ].join("\n")
  );

  const guide = join(root, "docs/picture-studio-download.md");
  if (!existsSync(guide)) throw new Error("docs/picture-studio-download.md is missing.");
  cpSync(guide, join(out, "README.md"));
  for (const f of ["LICENSE", "NOTICE"]) if (existsSync(join(root, f))) cpSync(join(root, f), join(out, f));
  writeFileSync(join(out, "VERSION.txt"), `Divination Station Picture Studio\nBuilt ${built} from commit ${commit} of the Divination Station source.\nSource and licence: see LICENSE and NOTICE in this folder.\n`);

  const files = readdirSync(out).filter((f) => f !== "SHA256SUMS.txt" && statSync(join(out, f)).isFile()).sort();
  writeFileSync(join(out, "SHA256SUMS.txt"), files.map((f) => `${sha256(join(out, f))}  ${f}`).join("\n") + "\n");

  const size = Math.round(statSync(join(out, "studio.mjs")).size / 1024);
  console.log(`Built ${out}\n  studio.mjs ${size} KB, ${files.length} files, commit ${commit}\n  Next: zip the folder, and publish the zip's SHA-256 beside the download.`);
}

main().catch((err) => {
  console.error("build-studio-package FAILED:", err instanceof Error ? err.message : err);
  process.exit(1);
});
