# Divination Station: the full setup guide

Written 2026-10-21 from the code and the docs, for the owner to read and decide what to change. It is a map: each part says what to do, what is built, what was checked, and where the detail lives. When this and the code disagree, the code wins. The one list of open work is `docs/open-items.md`; the decisions behind this guide are in `docs/plan-editions.md` ("Decided 2026-10-21").

## 0. Which setup do you want?

| You are | Setup | Built? | Detail |
|---|---|---|---|
| A person who wants the app for themselves | **A. Portable folder** (Windows, double-click `start-divination-station.bat`) | Built and run on this machine, 2026-10-21 | Part 1 |
| The same, on Mac, Linux or a server | **B. Docker** (`docker compose up`) | Built; image build checked 2026-10-21 (see Part 2 for what was and was not run) | Part 2 |
| A circle leader who wants friends to use their copy | **C. Share over Tailscale** | **Host mode built (H2.1);** a written guide for technical hosts, `docs/host-guide.md`; the H2.0 test is not done | Part 3 |
| A circle leader who lends a graphics card | **D. Picture Studio** | Built (2026-10-18). The zip and a trial on a second PC are still owed | Part 4 |
| The owner running the hosted site | **E. Hosted (the owner's computer + Neon)** | Running | Part 5 |
| The owner publishing downloads | **F. Release on itch.io** | Steps below; nothing published | Part 6 |

## 1. A. The portable folder (Windows)

**What the person does.** Download the zip from itch.io, unzip it, double-click `start-divination-station.bat`, choose "More info" then "Run anyway" if Windows warns (the program is unsigned, by decision), make an account, and use the app at `http://localhost:47831`. Close the black window to stop it. The person-facing version of these steps is `docs/local-edition-setup.md`; it is copied into the zip as `README.md`.

**What is in the folder.** `app` (the server, the migrations, the `data` files the first start reads), `node` (Node.js 24 for Windows, so nothing has to be installed), `start-divination-station.bat` and `.sh`, `settings.example.env`, `README.md`, `LICENSE`, `NOTICE`, `VERSION.txt`, `SHA256SUMS.txt`. About 196 MB, 6,245 files before zipping.

**Where the data goes.** `my-data` next to `app`: the PGlite database in `my-data\database`, pictures in `my-data\pictures` (so pictures live on the person's machine, decision P3), and the secrets the copy made for itself in `my-data\database.secrets.json`. An update replaces `app` and `node` and leaves `my-data`. `DS_DATA` in `settings.env` moves the whole folder.

**Build it** (you, on your PC, from a clean checkout with `npm ci` done):

    npx tsx scripts/build-local-package.ts --target all

`--edition feathered` builds the Feathered edition instead (no AI, no outgoing connections, for a flash drive; `docs/plan-feathered-edition.md`) into `dist/divination-station-feathered-<target>`; the build refuses to finish if any outside address or AI package is left in it. Without it, the folder is Winged, the full local edition. Each folder also holds an upgrade file that moves a copy of the other edition to this one in place, keeping its data (`scripts/change-edition.mjs`). `--target any` builds one folder that starts on Windows, Mac and Linux (a Node program for each in `node/<kind>`, every kind's picture library, and all three start files), for a flash drive used on more than one kind of computer; it downloads the Windows `node.exe` from nodejs.org too, so it can be built on any computer.

`--target` is one of `win-x64`, `linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64` or `all` (the default is this computer). The build runs once and each target gets its own folder, `dist/divination-station-<target>`, with the right Node program (downloaded from nodejs.org and checked against its published checksum) and the right picture library (sharp, from the npm registry). The Windows folder is also written as a `.zip`, and the Linux and Mac folders as `.tar.gz` archives, because a zip cannot keep the runnable mark on the Node program and the start script. Every target can be built on any computer: a Windows folder built on Linux or a Mac gets its `node.exe` from nodejs.org, checked like the others (added 2026-10-26).

It runs a standalone `next build`, copies what is needed, adds the Node program that ran the build, refuses to finish if any `.env` file got in, and writes `SHA256SUMS.txt`. The log prints each archive's SHA-256: publish it beside the download. Before building, make the reference bundle once (`npx tsx scripts/export-reference-bundle.ts`, dev branch only) or the encyclopedia starts empty; the build prints a warning when the bundle is missing.

**What was checked (2026-10-21, this PC):** the build; the packaged server starting from a different folder with the bundled Node; the first start making its own secrets and database; `/privacy` 200, `/setup` 200, `/forum` 404 (the circle pages are absent, as designed), a wrong `Host` name 421; the `.bat` logic with a `settings.env` that changes the port and the data folder.

**Linux and Mac packages (built 2026-10-21).** All five targets build from one `next build`: `win-x64`, `linux-x64`, `linux-arm64`, `darwin-arm64`, `darwin-x64`. The `linux-x64` archive was unpacked and started inside a Linux container whose own Node was a different version: the files kept their runnable marks, the bundled Node (24) ran, `sharp` loaded, the single-person copy answered `/privacy` 200 and `/forum` 404, and with `DS_MODE=host` in `settings.env` the same package answered `/forum` and `/circle` with a redirect to sign-in (present) and `/feedback` 404 (host mode, slice H2.1). The `linux-arm64` and the two Mac archives were built and their contents checked (right Node binary for the chip, right `sharp` files, runnable marks, no Windows files) but **never run**.

**What was checked (2026-10-26, cloud session, commit 6402201 plus the build fixes):** both editions built for all five targets one after the other (the second build used to copy the first one's packages into itself; `outputFileTracingExcludes` in `next.config.ts` now keeps `dist` out); the Windows zips pass `unzip -t` and carry `node.exe` and the Windows picture library; the Feathered and Winged `linux-x64` archives unpacked, started, and passed `scripts/smoke-pages.mts` on 79 pages at 390 and 1280 px; a fresh Feathered copy was walked through setup, locking, recovery codes, the welcome page, the tour and the quick hide. Still without the reference bundle.

**The clean-machine check, step by step:** `docs/usb-test-checklist.md` (Feathered on a flash drive, on someone else's computer).

**What was not checked:** a clean machine with no Node and no Visual C++ runtime; Windows SmartScreen on a downloaded zip; an antivirus scan of `node.exe`; the browser opening on its own (the `.bat` waits eight seconds and then opens `http://localhost:47831`); Mac and Linux arm64 (never run on that hardware; Gatekeeper on a Mac is the main risk); running from a path with spaces or non-English letters; NVDA on the first-run screens; and the reference bundle (not built here).

**Updating a copy (written 2026-10-28).** The person-facing steps are `UPGRADING.md` (copied into every download). What a release has to keep true for them to work:
- **One version number,** `version` in `package.json`, written into `VERSION.txt` by the packaging. Use `MAJOR.MINOR.PATCH` (0.1.0 is the first). Raise PATCH for fixes, MINOR for new features or new migrations, MAJOR for anything that needs the person to do something by hand. Tag the commit a download is built from (`v0.2.0`) and publish short release notes and the checksums with it.
- **Migrations only add.** Every edition applies new migrations at start-up (`lib/local-db.ts`, with a `before-update` backup first; `scripts/migrate.ts` for a Postgres server), so a person can skip versions. A shipped migration is never edited or renumbered, and never drops or rewrites the person's data. A rename is two releases: add the new column and copy into it, then stop using the old one.
- **The data folder's layout stays.** `my-data/database`, `my-data/pictures`, `my-data/database.secrets.json`, `my-data/database.backups` and `my-data/where.txt` are read by every version. A change there needs code that reads the old layout and moves it.
- **Built 2026-10-28:** (1) a local copy does not open data whose `schema_migrations` lists a migration its own folder does not have, unless that migration said older versions can still use the data (`NewerDataError` and `olderVersionsOk` in `lib/migrations.ts`, checked in `lib/local-db.ts` before anything is written); a restore of such a backup is refused the same way and the current data is put back. **Every migration after 099 carries a line `-- older-versions: ok` or `-- older-versions: no`** (`tests/local-db.test.ts` checks it). `ok` only when older code keeps working on the data: a new table, or a new column with a default that older code never reads. `no` for anything older code could misread: a new value in a column it reads, a changed constraint, moved data. When it is run, the answer is saved in `schema_migrations.older_ok`, because an older copy does not have the file. An `ok` migration must not depend on a one-time data step for rows written later: a person can go back, write in the older version, and update again, and the migration does not run twice. Put such a step in start-up code that runs every time (`lib/local-seed.ts`), or mark the migration `no`. A hosted copy (`scripts/migrate.ts`) has no such check. (2) `update-a-copy` in every download runs `change-edition.mjs --update`: same edition only, never an older version over a newer one (by `VERSION.txt`), `my-data` copied aside first. So **never delete or rename a shipped migration file**: copies that had it would refuse to start.
- **Open (recommended, not built):** (3) the version on the About or Settings page; (4) a "check for an update" button, off by default (H1b, parked).

**Known costs.** The folder is large because it carries Node (about 90 MB) and the PGlite engine (about 35 MB). Each release means a new zip; there is no auto-update by design ("nothing phones home").

## 2. B. Docker

    docker compose up --build

Then `http://localhost:47831`. The `Dockerfile` builds the same standalone server on `node:22-bookworm-slim`, runs as the unprivileged `node` user, keeps all data in the `ds-data` volume (`/data/database`, `/data/pictures`), and has a health check. `docker-compose.yml` publishes the port on `127.0.0.1` only. The container has the same host guard as the portable folder (`DS_EDITION=local` answers to `localhost` only), so it is not reachable from other computers unless you change that on purpose.

To use an image program on the host from inside the container, set `IMAGE_GEN_URL` to `http://host.docker.internal:5001` (the compose file maps the name).

See Part 7 for what the image build did and did not prove.

## 3. C. Sharing a copy with a circle over Tailscale or Headscale (host mode; guide: `docs/host-guide.md`)

**Update 2026-10-22.** The owner decided that hosting is for people who know how (a "technology witch" app for now). Host mode (H2.1) is built; `docs/host-guide.md` is the guide for a technical host, with Tailscale for a small circle and Headscale for a larger one (up to 30, `DS_HOST_CIRCLE_MAX`). The rest of this part is the original design.

**The decision (2026-10-21).** Circles are guided to make a Tailscale account and share their app with their friends. A circle is **5 to 10 people**, because the host's one graphics card makes pictures one at a time and PGlite opens one database session at a time; both are fine for ten light users and poor for thirty. The hosted site stays as a bridge for people without a circle, with stricter limits.

**How it would work for the leader.**
1. Start the app in "host mode" on the leader's PC.
2. Install Tailscale, sign in (free personal account), and run Tailscale Serve to give the app a private `https://<pc-name>.<tailnet>.ts.net` address. Serve is tailnet-only; do not use Funnel (public) for this.
3. In Tailscale's admin page, share the PC with each friend's Tailscale account.
4. Each friend installs Tailscale, accepts the share, and opens the address. They make an account on the leader's copy with a circle code.

**What has to be built first (none of it exists).**
- A **host mode** of the local edition: the circle, forum and invite pages (hidden today by `lib/edition-features.ts`) turned on; several accounts; `ALLOWED_HOSTS` filled in with the tailnet name (the host guard already supports this); the app listening on the Tailscale address and not only on loopback.
- A **guided setup page** in the app that tells the leader these steps in order and checks each one (`tailscale status`, the shared address).
- A **size cap** of 10 members for a hosted-by-leader circle, and a plain note that the leader's computer must be on for friends to use it.
- A check of the Tailscale free-plan sharing limits on the day this is written (not verified here).
- This **changes the 2026-10-20 decision** that local-only accounts do not connect to circles, in one way: a leader's copy becomes the server of that leader's circle. The hosted family circle is unchanged (decided 2026-10-21, H1). The full plan, with the unknowns to test first, is `docs/plan-host-mode.md`.

## 4. D. The Picture Studio (lend a graphics card)

Unchanged by the decisions above. A circle leader with a graphics card runs KoboldCpp and the Studio program; it makes only outbound connections to the website (or, once Part 3 exists, to the leader's own copy). Guide: `docs/picture-studio-download.md` (carried in the zip as `README.md`). Build it with `npx tsx scripts/build-studio-package.ts`. Still owed: the zip, its published checksum, and a trial on a second PC.

## 5. E. The hosted site (the owner's computer + Neon)

Production runs on the owner's own computer, served on the tailnet (the app was on Vercel until 2026-10-30). Environment variables: `ENVIRONMENT.md`. Migrations: `add-migration` and `live-migration-check` (you run live migrations). `DS_FAMILY_CIRCLE_ID` must be set for the production server. Keep `ART_REQUIRE_DISK` unset there while friends still save pictures in the database; give those accounts a smaller picture budget with `ART_DB_BUDGET_MB`.

## 6. F. Release on itch.io (unsigned)

- Make a **Windows** download from the zip, and a separate **Docker/source** note. The itch.io app (butler) can push the folder directly: `butler push dist/divination-station you/divination-station:windows`. Publish the zip's SHA-256 on the page.
- Say plainly on the page: the program is **not signed**; Windows will show "Windows protected your PC"; choose "More info" then "Run anyway"; the checksum shows the file is the published one.
- Antivirus programs sometimes flag unsigned programs that carry their own Node. Say so, and say how to compare `node.exe` with nodejs.org.
- Before any download: **ED18** (provenance), **ED20** (Felix G's written yes to the licence and credit), and the privacy and "not advice" text must be in the first screen (`docs/release-ladder.md`).
- Updates: a new zip each release. Tell people to move `my-data` into the new folder. A "check for an update" button remains an open idea.

## 7. What the Docker build proved

Checked on 2026-10-21 on this PC (Docker 29.7.2): `docker build` completed (the image is about 508 MB); the container started, reported **healthy**, applied the 88 migrations to `/data/database`, seeded 219 pieces and 0 concepts (no reference bundle on this branch), answered `/privacy` 200, `/forum` 404 and a wrong `Host` name 421. The first build failed until the build command was given a throwaway `SESSION_SECRET` (the sign-in code refuses to load without one); that value is set for the one build command only and is not in the final image.

Not checked: `docker compose up` itself (`docker compose config` accepts the file, but only `docker build` and `docker run` were used), the volume surviving a restart, Docker on a Mac or Linux computer, an ARM computer, and reaching an image program on the host through `host.docker.internal`.

## 8. Settings people may set

| Setting | Where | Effect |
|---|---|---|
| `ANTHROPIC_API_KEY` | `settings.env` or Docker env | Turns Claude features on, with the person's own key. Off otherwise. |
| `IMAGE_GEN_URL` | same | Address of an image program on the computer, to make pictures |
| `PORT` | same | A different port than 47831 |
| `DS_DATA` | same (portable folder only) | Keeps the data in another folder |
| `ALLOWED_HOSTS` | same | Extra names the copy answers to (a Tailscale name) |

## 9. Decisions this guide leaves for you

1. Whether the zip should carry Node (it does; it makes the download about 90 MB larger and removes the one thing a newcomer has to install).
2. How strict the bridge limits are on the hosted site (picture budget per account, account cap).
3. Whether to add an in-app "check for an update" button (off by default if added).
