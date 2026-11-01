# Environment variables: which ones go where

Written 2026-10-20 from the code (searched for every `process.env` read), `README.md`, `.env.example`, `docs/picture-queue.md`,
`docs/dev-database.md` and `docs/companion.md`. **Names only: no value from any real `.env` file is written here.**
When this and the code disagree, the code wins; `.env.example` and the README table are the other two lists to keep in step.
"Hosted server" below means a copy of the website that runs on a server other than the PC with KoboldCpp on it
(the app is no longer on Vercel, since 2026-10-30).

## The short answers

**Does production need `UPSTASH_REDIS_URL` as well as the REST URL and token? No.** They are two different doors into the same
Upstash database, used by two different programs:

| Variable | Used by | Where it goes |
|---|---|---|
| `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` | **The website** (`lib/studio-signal.ts`, `lib/shared-limits.ts`): plain HTTPS calls | **The hosted server** (and `.env.local` if your PC runs the app) |
| `UPSTASH_REDIS_URL` (`rediss://default:<password>@<host>:6379`) | **The picture studio** (`scripts/image-worker.ts`), which holds one outbound TCP connection and waits for the doorbell | **The studio's PC only.** Never on the hosted server, never in `.env.development.local` |

A serverless host cannot hold an open TCP connection, which is why the website uses the REST pair. The studio can, so it uses the `rediss://`
string, which gets it woken within a second or two. None of the three is required: without the REST pair the site counts
rate limits per server and falls back to the database for "awake/asleep"; without `UPSTASH_REDIS_URL` the studio looks at the queue
every `WORKER_IDLE_POLL_SECONDS` (600 s) instead of at once.

**Does production need the worker token?** No. `WORKER_TOKEN` and `APP_URL` are what the studio on your PC uses to *call* the
website. The website itself never reads them. They belong in the studio's env file, not on the hosted server.

**Which pictures/companion setting turns on "queue mode" on a hosted server?** Leaving `IMAGE_GEN_URL` and `COMPANION_URL` **unset**.
If either is set there the site tries to call your PC directly (`localhost` from the server's side) and fails.

## Where each env file is read

| Run | Files read, highest priority first |
|---|---|
| `npm run dev` | process env, `.env.development.local`, `.env.local`, `.env.development`, `.env` |
| `npm run build` / `npm start` (on your PC) | process env, `.env.production.local`, `.env.local`, `.env.production`, `.env` |
| **A hosted server** | Whatever that server is given (its own `.env*` files or its platform's settings). The `.env*` files in your folder are git-ignored, so they never travel with the code. |
| `npm run migrate`, `scripts/seed-*.ts`, `backup-db`, `restore-db` and most other `scripts/*.ts` | `.env.local` **only** (so by default they hit whatever database `.env.local` names, which is the **live** one). To aim at the dev branch, set `DATABASE_URL` in that one command (`docs/dev-database.md`) |
| The picture studio (`scripts/image-worker.ts`) | `.env.local` by default, or the file named with `--env FILE`. It reads only: `APP_URL`, `WORKER_TOKEN`, `IMAGE_GEN_URL`, `IMAGE_GEN_TIMEOUT_SECONDS`, `IMAGE_GEN_KIND`, `IMAGE_GEN_MODEL`, `IMAGE_GEN_SIZE`, `IMAGE_GEN_STEPS`, `IMAGE_GEN_CFG`, `WORKER_IDLE_POLL_SECONDS`, `UPSTASH_REDIS_URL`, `COMPANION_URL`, `COMPANION_PASSWORD`, `COMPANION_MODEL`. It never reads `DATABASE_URL` |
| `scripts/start-koboldcpp.ps1` | Its own `scripts/koboldcpp-startup.*.json`. From the top-level `envFile` it reads **only** `COMPANION_PASSWORD` (for the text worker's admin password). If it starts the studio, `studio.envFile` is passed to the studio as `--env` (empty = the studio reads `.env.local`) |

So `.env.local` has two jobs on your PC: it is the **live** database for scripts and builds, and (unless you pass `--env`) the
studio's settings. `.env.development.local` overrides it only for `npm run dev`, which is how the dev server gets the dev database.

## The matrix

`R` = required, `r` = recommended, `o` = optional, `-` = not read there, **`NO`** = do not set it there (it breaks something).

### Needed to run at all

| Variable | Hosted server (production) | Dev server | Studio | Scripts (migrate etc.) | Notes |
|---|---|---|---|---|---|
| `DATABASE_URL` | **R** (live branch) | **R** (dev branch, in `.env.development.local`) | **NO** (it warns if set and ignores it) | **R** (from `.env.local` = live; override per command for dev) | Neon: `sslmode=verify-full` |
| `SESSION_SECRET` | **R** | **R** | - | - | 32+ random characters. The app throws on start without it. Use a *different* one per environment |

### Claude (all optional; without a key the Claude features are off)

| Variable | Hosted server | Dev | Notes |
|---|---|---|---|
| `ANTHROPIC_API_KEY` | r | o | The app's own key |
| `AI_DAILY_LIMIT`, `AI_GLOBAL_DAILY_LIMIT`, `AI_QUOTA_TIMEZONE` | o | o | Defaults 15 per person, 300 for everyone |
| `INTERPRET_MODEL`, `GUIDE_MODEL`, `HAIKU_MODEL` | o | o | Model names; default `claude-haiku-4-5` |
| `CIRCLE_KEY_SECRET` | **R if circle owners may bring their own Claude key** | o | 32 random bytes (64 hex or base64). **Same value for as long as saved keys must stay readable**; losing or changing it locks them |
| `CLAUDE_API_KEY`, `CLAUDE_API_USER` | o | o | Older shared key for `/api/claude/*`. Prefer personal `dsc_` tokens made in Settings |

### Pictures and the AI companion: this is where the environments differ most

| Variable | Hosted server | Dev server (your PC) | Studio (your PC) | Notes |
|---|---|---|---|---|
| `IMAGE_GEN_URL` | **NO** | o (`http://localhost:5001`) | o (needs this, `COMPANION_URL`, or both) | Set on a hosted server = the site tries to reach your PC and pictures fail |
| `COMPANION_URL` | **NO** | o (`http://localhost:5002`) | o | Same. On the dev server it makes the companion answer directly |
| `COMPANION_PASSWORD` | **NO** | o | o | KoboldCpp router-mode admin password. `start-koboldcpp.ps1` reads it too |
| `COMPANION_MODEL` | - | o | o | `.kcpps` file name. Default `Gemma4-v2-Q4plain.kcpps` |
| `COMPANION_DAILY_LIMIT` | o | o | - | Per person per day, default 30 |
| `IMAGE_DAILY_LIMIT` | o | o | - | Per person per day, default 30 |
| `IMAGE_MODE` | o (`queue` forces queue mode) | o | - | Normally left unset: set/unset `IMAGE_GEN_URL` decides |
| `IMAGE_GEN_TIMEOUT_SECONDS` | - | o (default 900) | o (default 900) | Bigger for SDXL |
| `IMAGE_GEN_KIND` | **NO** | o | o | Which program is at `IMAGE_GEN_URL`: `koboldcpp` (the default; also right for AUTOMATIC1111, Forge and SD.Next) or `comfyui`. A wrong word stops the studio at start |
| `IMAGE_GEN_MODEL` | **NO** | o (ComfyUI only) | o (ComfyUI only) | The `.safetensors` file name in ComfyUI's `models/checkpoints` folder |
| `IMAGE_GEN_SIZE` | **NO** | o | o | `sdxl` = ask at an SDXL model's own size (about 1024 by 1024). Off unless set. Slower: see `docs/picture-model-at-home.md` |
| `IMAGE_GEN_STEPS`, `IMAGE_GEN_CFG` | **NO** | o | o | Default 20 and 7. A fast "Lightning" or "Turbo" model wants about 6 and 2 |
| `KOBOLDCPP_URL` | **NO** | o | - | Only turns on the local-AI provider in Settings |
| `ART_DIR` | **NO** | o (`C:/Users/you/DivinationStationArt`) | - | Pictures as files on the PC. On a hosted server without it, pictures stay in the database |
| `ART_REQUIRE_DISK` | **NO** for the beta (people could not save pictures at all) | o | - | `1` = refuse to store pictures in the database |
| `ART_DB_BUDGET_MB` | o (default 25 per person) | - | - | |

### The picture studio (the program on your PC that connects the live site to KoboldCpp)

| Variable | Hosted server | Studio | Notes |
|---|---|---|---|
| `APP_URL` | **NO** | **R** (`https://` address of the site it works for) | Tells the studio which website's queue to take. Plain `http://` only for `http://localhost:3000` |
| `WORKER_TOKEN` | **NO** | **R** (`dsw_...`) | Made at `/admin/workers` on **that** site (a dev-branch site has its own tokens: a token only works on the website whose database holds it). Shown once |
| `UPSTASH_REDIS_URL` | **NO** | o (`rediss://...`, two `s`) | The instant doorbell |
| `WORKER_IDLE_POLL_SECONDS` | - | o | Default 1800 with Redis, 600 without. Don't make it much shorter: every look keeps the free database awake |

### The doorbell and shared limits (the website's half)

| Variable | Hosted server | Dev server | Notes |
|---|---|---|---|
| `UPSTASH_REDIS_REST_URL` (`https://....upstash.io`) | o, but **both or neither** | o | Needs both of these two to take effect |
| `UPSTASH_REDIS_REST_TOKEN` | o, but **both or neither** | o | Restart the server once after adding them |

If your PC's `.env.local` also has the REST pair (it does today), your dev server shares live's Redis: the picture doorbell and
the per-minute limit counters are then shared between dev and live. Harmless but untidy. To keep dev apart, put empty
`UPSTASH_REDIS_REST_URL=` and `UPSTASH_REDIS_REST_TOKEN=` in `.env.development.local`. The code treats an empty value as "not set up"
(`lib/studio-signal.ts`), and Next should not let the lower-priority `.env.local` fill it back in, but I have not tried this: check the
dev server's log for `[limits]` lines or ring the doorbell once to be sure.

### Editions, hosts and limits (optional)

| Variable | Hosted server | Notes |
|---|---|---|
| `DS_EDITION` | **NO** (leave empty = hosted) | `local` is for a copy on one person's own computer; it refuses any host except localhost |
| `DS_MODE` | **NO** | Only with `DS_EDITION=local`. `host` turns on the circle, forum, join and invite pages and caps a circle at 10 (docs/plan-host-mode.md); empty is a copy for one person. Ignored on a hosted copy |
| `ALLOWED_HOSTS` | o, only if you want a host check | Setting it turns the host check on even for a hosted copy. Wrong names get a 421 |
| `ALLOWED_ORIGINS` | o | Extra web addresses whose pages may send changes to the app |
| `MAX_ACCOUNTS` | o | Default 200, `0` = no ceiling |
| `DB_POOL_MAX` | o | 1 to 20, default 10. Lower it if Neon refuses connections |
| `DS_DB_DIR`, `DS_REFERENCE_BUNDLE`, `DS_MIGRATIONS_DIR` | **NO** | The local edition's own database folder (PGlite) and its helpers |
| `NODE_ENV` | set by Next (`npm start` = `production`) | `production` makes the sign-in cookie `secure`. There is no other cookie setting |

### Scripts and one-offs (never needed on a hosted server)

| Variable | Used by | Notes |
|---|---|---|
| `ADMIN_USERNAME`, `ADMIN_INITIAL_PASSWORD` | `npm run migrate` | Only to make the first admin on an empty database |
| `BACKUP_DIR` | `scripts/backup-db.ts` | Where backups are written. The backup also copies `ART_DIR` |
| `SEED_DATA_DIR` | `scripts/seed-*.ts`, `import-sqlite.ts` | Where the seed CSV files are |
| `DATABASE_URL_2` | `scripts/find-stray-art.ts` | A second database to compare |
| `DEV_DATABASE_HOST_PREFIX` | `scripts/dev-database.ts` (the audit, measure, review, reference-bundle and symbol-seed scripts) | Optional, for example `ep-your-dev-branch`. Without it those scripts treat the database in `.env.development.local` as the dev one and refuse any other unless given `--allow-live` |
| `DEV_ALLOWED_ORIGINS` | `next.config.ts`, `npm run dev` only | Optional, in `.env.development.local`: other hostnames the dev server may serve, comma-separated, for example `your-pc.your-tailnet.ts.net` |
| `KCPP_ADMINPASSWORD` | `scripts/companion-bakeoff.ts` | KoboldCpp admin password for the bake-off |

## A snapshot of your files, 2026-10-20 (names only)

What I saw in your project folder, and what it means:

| File | Has | Comment |
|---|---|---|
| `.env.local` | `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`, `INTERPRET_MODEL`, `SECURE_COOKIES`, `ART_DIR`, `KOBOLDCPP_URL`, `IMAGE_GEN_URL`, `COMPANION_URL`, `COMPANION_PASSWORD`, `UPSTASH_REDIS_URL`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `APP_URL` | The live database + the studio's settings. **No `WORKER_TOKEN`** here, so a studio started with defaults cannot log in |
| `.env.development.local` | `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`, `INTERPRET_MODEL`, `KOBOLDCPP_URL`, `IMAGE_GEN_URL`, `ART_DIR`, `ART_REQUIRE_DISK` | The dev branch for `npm run dev`. Fine. No REST pair, but it inherits the one from `.env.local` (see above) |
| `.env.production` | `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `CLAUDE_API_KEY`, `INTERPRET_MODEL`, `SECURE_COOKIES`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, `APP_URL`, `WORKER_TOKEN` | Was the list copied into Vercel, which is gone. `npm run build` and `npm start` on your PC read it after `.env.local` |

Things to tidy:

1. **`SECURE_COOKIES` is not read by any code.** Cookie security follows `NODE_ENV`. It is harmless; remove it so nobody thinks it does something.
2. **`APP_URL` and `WORKER_TOKEN` in `.env.production`:** don't give them to a hosted server. They belong to the studio. The studio reads `.env.local`
   unless told otherwise, and `.env.production` lacks the rest of its settings. The tidy way is one file only the studio reads, for example
   `.env.studio` (`.env*` is git-ignored) holding `APP_URL`, `WORKER_TOKEN`, `IMAGE_GEN_URL`, `COMPANION_URL`, `COMPANION_PASSWORD`,
   `UPSTASH_REDIS_URL`, started with `npx tsx scripts/image-worker.ts --env .env.studio`. The KoboldCpp start-up script does this for you
   when `studio.envFile` in its settings file names that file.
3. **`CIRCLE_KEY_SECRET` is in none of these three files.** It was set in Vercel's settings, which are gone: if circle owners saved their own
   Claude keys, the live site needs the same value again, so find your saved copy and keep it somewhere safe, because losing it makes saved circle keys unreadable. (Not needed on your dev server unless you test that feature.)
4. **`UPSTASH_REDIS_URL` must stay out of a hosted server and `.env.development.local`.** Today it is only in `.env.local`, which is right.

## Checklist per environment

**A hosted server, production:** `DATABASE_URL` (live), `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `CIRCLE_KEY_SECRET`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`; optional limits. **Unset:** `IMAGE_GEN_URL`, `COMPANION_URL`, `COMPANION_PASSWORD`, `KOBOLDCPP_URL`, `ART_DIR`, `ART_REQUIRE_DISK`, `APP_URL`, `WORKER_TOKEN`, `UPSTASH_REDIS_URL`, `DS_*`.

**Your PC, dev server (`npm run dev`):** `DATABASE_URL` (dev branch) and `SESSION_SECRET` in `.env.development.local`; `IMAGE_GEN_URL`, `COMPANION_URL`, `COMPANION_PASSWORD`, `ART_DIR` if you want the real image and text tools.

**Your PC, picture studio:** `APP_URL` (the live site), `WORKER_TOKEN` (made on the live site, with "Companion requests" ticked for your own PC), `IMAGE_GEN_URL`, `COMPANION_URL`, `COMPANION_PASSWORD`, optionally `UPSTASH_REDIS_URL`. Not `DATABASE_URL`.

**Your PC, KoboldCpp start-up script:** nothing in `.env` except `COMPANION_PASSWORD` (read from the file named in `envFile`).

Check the studio's settings with `npx tsx scripts/image-worker.ts --check --picture` (add `--env .env.studio` if you use one): it
reports each setting, whether the website accepts the token, and makes one test picture.
