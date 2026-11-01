# Divination Station

A private divination app that grows with you and helps you sharpen your own intuition. You are the author of every
meaning; the app is a mirror. It began as a tarot app and now has many more forms of divination available as  randomized , with your own meanings first in every one.

It runs on your own computer. There are two editions to download:

| | **Feathered** | **Winged** |
|---|---|---|
| For | One person, on a computer or a flash drive | One person, or a circle leader who serves friends |
| AI features | None | Optional: Claude interpretations, the AI companion, the picture maker, each off until you turn it on |
| Connects to the internet | Never | Only for an AI feature you turn on |
| Circles and forums | No | Yes, in host mode |
| Lock your writing with your password | Yes | Yes |

Start with **Feathered** if you are not sure. You can move to Winged later and keep everything you wrote.

This app is for reflection. It is not medical, mental-health, legal or financial advice.

## The Feathered edition

The light copy: every tool, your own meanings, journals, Patterns, predictions and look-backs, the oracle deck kit with
your own drawn or uploaded pictures, export and backups. No AI, and it connects to nothing outside your computer.

### Start it
1. Download the Feathered file for your kind of computer. For a flash drive you will use on more than one kind of
   computer, download the **any computer** file instead (it is larger).
2. Unzip it to a folder, or onto your flash drive. Do not run it from inside the zip.
3. Start it:
   - **Windows:** double-click `start-divination-station.bat`. Windows may say "Windows protected your PC", because
     this program is not signed. Choose **More info**, then **Run anyway**.
   - **Mac:** the first time, open Terminal, type `sh ` (with a space), drag `start-divination-station.command` into
     the window and press Enter. After that, double-click it.
   - **Linux:** run `sh start-divination-station.sh`.
4. The first start takes about half a minute. The app opens in a private browser window at `http://localhost:47831`.
5. Make your account: a name and a password or passphrase. It exists only in this folder.
6. Leave the black window open while you use the app. To stop it, press **Stop and remove the drive** in Settings, or
   close the black window.

### What to know
- **Your writing** is kept in the `my-data` folder beside the app. Back it up by closing the app and copying that folder.
- **To update,** unzip the new version to a new folder and copy `my-data` into it; [`UPGRADING.md`](UPGRADING.md) has the steps.
- **Locking** (chosen for you on the first screen) keeps everything you write as one sealed file that opens only with
  your password. You are shown recovery codes once: keep them somewhere other than the drive. If you lose both your
  password and your recovery codes, nobody can get your writing back.
- **The quick hide:** press **Hide** at the top of any page, or Esc twice. The app signs you out, locks your writing and
  shows a small snake game. To come back, play a round and type your password as the high-score name.
- **On a flash drive,** format the drive as exFAT if you can, and press **Stop and remove the drive** before you take it out.

The full guide, including what the app leaves on a computer and how to move to Winged, is
[`docs/feathered-guide.md`](docs/feathered-guide.md). It comes in the download as `README.md`.

## The Winged edition

The full copy. Everything in Feathered, plus the optional AI features (with your own Claude key or a model on your own
computer), and host mode, which lets a circle leader serve their circle and its forum to friends over Tailscale or
Headscale.

### Start it
- **Windows:** unzip the download to a folder you will remember, for example `C:\DivinationStation`, and double-click
  `start-divination-station.bat`. If Windows says "Windows protected your PC", choose **More info**, then **Run anyway**.
- **Mac:** download the file for your Mac (`darwin-arm64` for Apple silicon, `darwin-x64` for an Intel Mac) and unpack
  it. The first time, open Terminal, type `sh ` (with a space), drag `start-divination-station.command` into the window
  and press Enter. After that, double-click it.
- **Linux:** download `linux-x64` (most PCs) or `linux-arm64` (for example a Raspberry Pi), unpack it with
  `tar -xzf`, and run `sh start-divination-station.sh`. Ubuntu, Debian, Fedora and other glibc Linuxes work; Alpine
  does not (use Docker there).
- **Docker:** in the folder, run `docker compose up --build`. Your data is kept in the `ds-data` volume.

The first start takes about half a minute; then open `http://localhost:47831` if your browser does not open by itself.
Make your account. Nothing needs to be installed: Node.js comes in the `node` folder.

**On a flash drive:** the app normally keeps your data in a folder of database files, and that folder does not work on
an exFAT or FAT32 drive. On such a drive the app keeps the database in one file instead
(`my-data\database-in-one-file.tar.gz`), by itself, and says so in the black window. That file is saved a few seconds
after each change and when the app stops, so stop the app (Settings, or close the black window) before you take the
drive out.

### Settings you may want
Copy `settings.example.env` to `settings.env` and take out the `#` before any line you want to enable:
- `ANTHROPIC_API_KEY`: your own Claude key, which turns the Claude features on. Without it they stay off. Keep this file private.
- `IMAGE_GEN_URL`: the address of an image program on your computer, for the picture maker.
- `PORT`: another port, if 47831 is taken.
- `DS_DATA`: keep your data in another folder.

### Updating and backups
Your writing is in the `my-data` folder. To update, make a backup, close the app, unzip the new version to a new folder
and copy `my-data` (and `settings.env`, if you have one) into it. The first start brings your data up to date and saves a
backup of it as it was. [`UPGRADING.md`](UPGRADING.md) has the full steps, for Docker too, and how to go back. The app also
makes a weekly backup by itself (Settings, then Backups), and has a "Back up now" button.

### Serving a circle (host mode)
Host mode is for people who are comfortable setting up Tailscale or Headscale. While it is on, you can read what your
friends write in your copy. Read [`docs/host-guide.md`](docs/host-guide.md) first; it comes in the download as `HOSTING.md`.

The full Winged guide, with troubleshooting and how to check a download, is
[`docs/local-edition-setup.md`](docs/local-edition-setup.md).

## Licence
The program's code is released under the **GNU Affero General Public License, version 3 only** (SPDX: `AGPL-3.0-only`;
`LICENSE`). "Only" means version 3 and no other: it does not say "or any later version", so a later version of the licence
would not apply to this code unless the owner chose to relicense it (decided 2026-10-18). The licence covers
**code only**: the tarot text and data, the card pictures and the fonts keep their own terms, listed with their
credits in `NOTICE`.

## For developers: running it from the source code

Built with Next.js 16 (App Router), React 19, Tailwind 4, and Postgres (Neon for the hosted copy, PGlite in the
downloads). Everyone can choose their own colours (Settings, then "Choose your colours"), starting from the checked themes.
This part covers running the app from the source code on **Windows**. Building the Feathered and Winged downloads is in
[`docs/setup-guide.md`](docs/setup-guide.md).

### Prerequisites
- **Node.js 20.9 or newer** (LTS). Install with `winget install OpenJS.NodeJS.LTS`, then open a new terminal.
  Check with `node -v`.
- A Postgres database. The project uses [Neon](https://neon.tech); any Postgres works.
- An Anthropic API key for the AI features.

### First-time setup
```powershell
git clone https://github.com/KyRocks19/divination-station-takeoff.git
cd divination-station-takeoff
npm install
copy .env.example .env.local   # then fill in the values (see below)
npm run migrate                # creates tables, seeds preset spreads and an admin user
```

#### Environment variables (`.env.local`)
| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. Use `sslmode=verify-full` for Neon. |
| `SESSION_SECRET` | Random string of 32+ characters used to encrypt login cookies. |
| `ANTHROPIC_API_KEY` | Claude API key for interpretations. |
| `CLAUDE_API_KEY` | Optional and older: one shared secret for the `/api/claude/*` routes (sent as `x-claude-key`), for accounts an admin switched on. Prefer a personal token made in Settings (`dsc_...`), which acts for one account only; once you have one, remove this. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Optional. The picture doorbell (`docs/picture-queue.md`) **and** the limits on writes and Claude requests per minute, so every server shares one count. Without them each server counts for itself. |
| `CLAUDE_API_USER` | Optional. Username the key acts for when a request has no `x-claude-user` header. Defaults to the first admin account. |
| `INTERPRET_MODEL` | Optional. Defaults to `claude-haiku-4-5`. `GUIDE_MODEL` is an optional override. |
| (cookies) | The sign-in cookie is marked secure whenever `NODE_ENV` is `production` (`lib/session-options.ts`); there is no separate setting. |
| `ADMIN_USERNAME`, `ADMIN_INITIAL_PASSWORD` | Optional. Only used by `npm run migrate` when creating the first admin on an empty database. |
| `KOBOLDCPP_URL` | Optional. Enables the local-AI provider in Settings. |
| `COMPANION_MODEL` | Optional. The KoboldCpp config file (in its admin folder) the AI companion uses. Default `Gemma4-v2-Q4plain.kcpps`. |
| `COMPANION_URL` | Optional. KoboldCpp (router mode) address for the AI companion, for example `http://localhost:5002`. Set it on the owner's own computer only, never on a hosted server elsewhere (docs/companion.md). |
| `COMPANION_PASSWORD` | Optional. The admin password KoboldCpp was started with. |
| `COMPANION_DAILY_LIMIT` | Optional. Companion requests per person per day (default 30; 0 switches it off). |
| `IMAGE_GEN_URL` | Optional. Address of an image tool on your own computer that speaks the A1111 `/sdapi/v1/txt2img` API (KoboldCpp with an image model does), for example `http://localhost:5001`. Turns on "Make pictures" on an oracle item's page. The app's server calls it (the browser never does), so the tool must be reachable from the computer that runs the app; it then works from any device that can open the app, including a phone over Tailscale. It cannot work on a server in the cloud, which cannot reach your PC. |
| `IMAGE_GEN_TIMEOUT_SECONDS` | Optional. How long the app waits for one picture or one enlargement from the image tool: 900 (15 minutes) unless set, from 30 to 3600. Large models (SDXL) can need several minutes per picture on a modest graphics card. Restart the app after changing it. |
| `ART_DIR` | Optional. A folder on the computer that runs the app (for example `C:/Users/you/DivinationStationArt`). When set, pictures for oracle items and the gallery are saved there as files and the database keeps only a small record, so Neon does not fill up. They are served only while that computer is on, and are not backed up for you: back the folder up. Without it, pictures stay in the database. | Pictures kept as files may be up to 10 MB and 2400 pixels on the long side (in the database they stay at 1 MB and 1000 pixels), and lists show small cached previews of them (`?s=thumb`, made with `sharp`).
| `CIRCLE_KEY_SECRET` | Needed only if circle owners may bring their own Claude key (migration 065). 32 random bytes as 64 hex characters or base64; make one with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`. It encrypts the circles' keys (AES-256-GCM) and lives only in the server's environment (`.env.local` on the PC), never in the database or git. Without it a key cannot be saved. **If it is lost or changed, saved circle keys can no longer be opened** and their owners must enter them again; members are told the key cannot be used, and the app's own key is not used in its place. |
| `DS_EDITION` | Optional. `local` for a copy that runs on one person's own computer (docs/plan-editions.md): it then answers only to `localhost`, `127.0.0.1` and `[::1]` and refuses any other `Host` name, which stops a web page from reaching it by DNS rebinding. Empty or anything else is the hosted edition. |
| `DS_MODE` | Optional, only with `DS_EDITION=local`. `host` makes the copy also serve the circle of the person who runs it, over Tailscale (docs/plan-host-mode.md): the circle, forum, join and invite pages are on and a circle holds at most 10 people. Empty is a copy for one person. Ignored on a hosted copy. |
| `DS_FAMILY_CIRCLE_ID` | The numeric ID of the one circle allowed to use the hosted app. Set it wherever the hosted app runs. Production builds deny signed-in access if it is missing or invalid; people outside that circle use the local PGlite edition. Local editions with `DS_DB_DIR` ignore this setting. |
| `ALLOWED_HOSTS` | Optional. Extra host names this copy may be reached by, comma separated, for example a Tailscale name such as `my-pc.tail1234.ts.net`. Setting it turns the host check on even for a hosted copy, and then only the listed names (plus loopback on a local copy) are answered. A request for another name gets a plain 421 message. |
| `MAX_ACCOUNTS` | Optional. The most accounts this copy holds: 200 unless set, `0` for no ceiling. When it is reached, a new person's code is not used and they are told the copy is full. Accounts an administrator makes by hand are not blocked. |
| `ART_REQUIRE_DISK` | Optional. Set to `1` on a hosted copy that has no `ART_DIR` (for example on a rented server): it then refuses new pictures instead of filling the database, and shows existing ones as "stored on the owner's computer" when that computer is off. |

The Claude tool key is shared by the household. A request names its account with an `x-claude-user: <username>`
header, and the key only works for accounts an admin has ticked "Claude key" for in **Settings → User Management**.
Anyone holding the key can reach every ticked account, so share it only with people you would trust with those readings.

Hosted access is limited to the circle whose ID is set in `DS_FAMILY_CIRCLE_ID`. Circle membership is checked for signed-in pages and APIs, Claude tool tokens, and picture-computer tokens. To find the ID, query `SELECT id, name FROM circles ORDER BY id;` on the hosted database, then set the chosen numeric ID in the hosted server's environment. Existing database rows are not deleted. People outside that circle use the local edition with PGlite; their local data stays on that computer.

`.env*` files are git-ignored. Never commit them.

On an empty database, `npm run migrate` creates an admin account. Its username is `ADMIN_USERNAME` (default
`admin`) and its password is `ADMIN_INITIAL_PASSWORD`. If that is not set, a random password is generated and
printed once in the migrate output. Sign in and change it in **Settings**. Existing databases are not touched.

### Running
```powershell
npm run dev        # development at http://localhost:3000
npm run build      # production build
npm run start      # serve the build (listens on this computer only; a phone reaches it through `tailscale serve`)
```
If port 3000 is busy, Next picks the next free one and prints it.

### Updating the copy you run from the source
Double-click `update-and-restart.cmd` in the project folder (or run
`powershell -ExecutionPolicy Bypass -File scripts\update-and-restart.ps1`). It:
1. stops if you have changes that are not committed, before anything else;
2. asks, then stops the app on port 3000 (the server and the npm window that started it);
3. pulls the newest commits of the branch you are on (`git pull --ff-only`, so your own commits are never rewritten);
4. runs `npm ci` when `package-lock.json` changed;
5. lists any new migrations, and **does not run them**: `npm run start` and `npm run migrate` use the live database, so
   run `npm run migrate` yourself when you are ready (the app works before them, with their features off), or use
   `update-migrate-and-restart.cmd` (below);
6. runs `npm run build`, and if that fails, prints the command that takes you back to the version you had;
7. starts the app again in its own window (`npm run start`, or `npm run dev` if that is what was running) and waits
   until `http://localhost:3000/login` answers.

Options: `-Port 3001`, `-Mode start` or `-Mode dev`, `-NoPull` (rebuild and restart what is there), `-Migrate` (below),
`-Yes` (do not ask before stopping or migrating). By hand, the same steps are: Ctrl+C in the app's window,
`git pull --ff-only`, `npm ci` (if `package-lock.json` changed), `npm run build`, `npm run start`.

To migrate as well, double-click `update-migrate-and-restart.cmd` instead (the same script with `-Migrate`). Before it stops
anything, it reads `DATABASE_URL` from `.env.development.local` and `.env.local`, shows the two hosts (never the
addresses), refuses if they are the same, and asks once. In place of step 5 it runs `npm run migrate` on the dev branch, then
`npm run backup` of live, then `npm run migrate` on live, so a migration that fails on dev never reaches live. It runs every
file a database lacks, not only the new ones, and `npm run migrate` skips what is applied, so running it with nothing owed is
harmless. If a step fails it stops there, says what was and was not migrated, and leaves the app stopped.

### Continuous checks (GitHub Actions)
`.github/workflows/ci.yml` runs on every push and pull request, and once a week on Mondays even without a push.
It needs no secrets and no database. It runs the same commands you can run yourself:

```powershell
npm ci
npx next typegen                              # writes the route types (RouteContext) that tsc needs
npx tsc --noEmit
npm test
npm run build                                 # CI sets a throwaway SESSION_SECRET and no DATABASE_URL
npm audit --omit=dev --audit-level=high       # fails only on high or critical advisories in server packages
```

The audit runs as its own job, so a new advisory shows up as a red "Dependency audit" without hiding whether the code
itself still passes. `.github/dependabot.yml` asks Dependabot for grouped npm **security** fixes only (no ordinary
version bumps) and a monthly update of the pinned actions. For the security pull requests to appear, switch on
**Dependabot alerts** and **Dependabot security updates** under the repository's Settings > Code security.

### Database
- Migrations live in `migrations/NNN_name.sql` and are applied in order by `npm run migrate`. Applied files are
  recorded in the `schema_migrations` table, so re-running is safe. Write new migrations to be idempotent.
- `npm run migrate` and the seed scripts write to whatever `DATABASE_URL` points at. If that is your live
  database, treat dev as production.

#### Seeding card and concept data
The source material (CSVs, Obsidian notes) is not stored in this repo. By default the scripts look in a sibling folder,
`..\divination-station-reference\` (an older `..\crossroads-of-tarot-reference\` is still found). Set `SEED_DATA_DIR` to use another location.

```powershell
npx tsx scripts/seed-encyclopedia.ts --dry-run          # preview: runs in a transaction and rolls back
npx tsx scripts/seed-encyclopedia.ts                    # apply
npx tsx scripts/seed-reversed-concepts.ts --dry-run
npx tsx scripts/seed-reversed-major-arcana.ts --dry-run
```
Always do the `--dry-run` first. All seed scripts are idempotent.

### Project layout
| Path | What it is |
|---|---|
| `app/` | Pages and API routes (App Router) |
| `components/` | React components; `components/ui/` is the shared design system, `components/archive/` holds retired pieces kept for later |
| `lib/` | Database, auth/session, card and tool data, helpers |
| `docs/` | The design system (tokens, shared pieces, themes, the world map) |
| `migrations/` | SQL schema migrations |
| `scripts/` | Migration runner, seed and import scripts, icon generator |
| `public/` | Card images, PWA icons, service worker |
| `proxy.ts` | Auth gate for all routes (Next 16's replacement for `middleware.ts`) |

### Working on it with Claude Code
Start with `AGENTS.md`, then the "Handoff summary" at the top of `.claude/skills/oracle-feature-design/PROGRESS.md`. The
skills in `.claude/skills/` carry the project conventions: `oracle-feature-design` (the goal, the working rules, the
design rules), `run-app`, `add-migration`, `seed-data`, `next16-docs`, `new-api-route`, and `pre-commit-check` (which names the other checks that apply: `data-lifecycle-check`,
`live-migration-check`, `copy-check`, and so on). `oracle-feature-design` also holds the tarot and AI principles. The design system is in `docs/design-system.md` and at `/design` once signed in.
This version of Next.js has breaking changes, so read `node_modules/next/dist/docs/` before changing framework code.

Work is done one small slice at a time and committed per finished slice on a feature branch and merged to `main` by pull request. Nothing is
pushed unless the owner asks. The checks are `npx tsc --noEmit` and `npm run build`, then clicking through the running
app; each Claude session makes its own test account (see the working notes).
