# Pictures for friends: the queue and the picture studio

**Current open setup and checks:** P2/P3, O4, O6, and E10 in `docs/open-items.md`. The implementation details below are reference material, not a separate backlog.

Written 2026-10-13. A hosted website on another server cannot reach the image tool on your PC, and your PC is not always on. So a
request for pictures **waits in the database**, and a small program on your PC, the **picture studio**
(`scripts/image-worker.ts`), takes them from the front of the line, makes each with the image tool, and puts the finished
picture back for the person to collect. If the PC is off, pictures wait up to 24 hours and the page says the studio is asleep.
Everything else on the website works whether the PC is on or not.

The studio only makes connections **out** (to the website, to the image tool on the same PC, and to Redis). Nothing on your PC
is reachable from the internet. **Since 2026-10-16 the studio no longer holds the database password**: it talks to a small worker
API on the website with a token of its own (see "The worker API and its tokens" below).

## How it behaves
- A person asks for 1 to 7 pictures (`MAX_BATCH` in `lib/art-maker.ts`; it was 10, which the owner's computer could not keep up with, then 5, then 7) on an item's page ("Ask for N pictures"). They can leave the page and come back:
  finished pictures reappear, waiting ones keep their place.
- Limits per person: as many pictures waiting or being made as the biggest batch (7), twice that waiting/being made/finished-and-not-yet-kept (14), 30 pictures a day
  (`IMAGE_DAILY_LIMIT`; you can set one person's number, or 0 to switch it off for them, in Settings > Accounts).
  A picture cancelled before it is started, or one that fails, is not counted against the day.
- Turns: people take turns. Someone who asked for 5 pictures does not make everyone else wait for all five.
- A finished picture is kept in the database until the person keeps it somewhere (on the item or in the gallery), discards it,
  or 24 hours pass. Pictures you do not keep are therefore never stored for long.
- Saved pictures on the hosted site live in the database (about 300 KB each), so each person has a share of 25 MB
  (`ART_DB_BUDGET_MB`). Do **not** set `ART_REQUIRE_DISK=1` on the hosted site for the beta, or friends cannot save pictures at all.
  Your own computer's copy of the app still uses `ART_DIR` as before.
- "Make larger" is not available through the queue (it needs the image tool right then).
- What people type is stored in the queue until the picture is made and is sent to your image tool. The page says so. Your PC will
  draw whatever it is asked; the studio log (`[image-worker]` lines) names the user and the job, and you can switch one person's
  pictures off in Settings.

## One-time setup (yours; I did not touch the hosted site or your PC)
1. **Migrations.** `npm run migrate` on the dev branch first, then live (see `docs/dev-database.md`). 039 to 042 are new.
2. **The hosted site's environment.** Leave `IMAGE_GEN_URL` unset there (that is what puts the site in queue mode; `IMAGE_MODE=queue` also
   forces it). Optional: `IMAGE_DAILY_LIMIT`, `ART_DB_BUDGET_MB`. Your PC's own copy of the app, which has `IMAGE_GEN_URL`, still
   makes pictures directly as before.
3. **A token for the studio.** Run migration 062 (dev branch first, then live). On the website, open **Admin > Picture computers**
   (`/admin/workers`), give the computer a name, tick what it may take (pictures; companion requests only for your own computer,
   because they carry people's writing), press **Make a token**, and copy it. It is shown only once.
4. **Studio on your PC.** Put two lines in `.env.local` (or the file named with `--env FILE`):
   `APP_URL=https://<the website's address>` and `WORKER_TOKEN=dsw_...`. The studio reads only the settings it uses
   (`APP_URL`, `WORKER_TOKEN`, `IMAGE_GEN_URL`, the companion's and Redis's), never `DATABASE_URL`, so your `.env.local` can keep
   `DATABASE_URL` for your own copy of the app. `APP_URL` must be `https://`; plain `http://` is only allowed for this computer
   (`http://localhost:3000`). Start KoboldCpp with an image model, then double-click `start-picture-studio.cmd` (or run
   `npx tsx scripts/image-worker.ts`). It prints the website and the token's name first. Stop with Ctrl+C or by closing the
   window; the site shows "asleep" at once. Before the first start, run the test: `npx tsx scripts/image-worker.ts --check --picture`
   (settings, website, image program, one test picture thrown away; it asks the website through `POST /api/worker/check`, which
   changes nothing). The downloadable studio for people who lend a PC is built with `npx tsx scripts/build-studio-package.ts`
   into `dist/picture-studio` (one bundled `studio.mjs`, the guide, the licence files and `SHA256SUMS.txt`; it refuses to build if
   database code is inside).

## The worker API and its tokens (built 2026-10-16, security audit plan item 2)
The studio used to connect to Postgres with `DATABASE_URL`, which can read and change everyone's writing. Now it holds only a
**worker token** and can do only what a studio needs. Code: `lib/worker-tokens.ts` (tokens), `lib/worker-protocol.ts` (what the
two sides say; no database code), `lib/worker-client.ts` (the studio's side), routes under `app/api/worker/`, the admin screen
`components/admin/WorkerTokens.tsx`. Tests: `tests/worker-api.test.ts`.
- **Tokens.** `dsw_` and 32 random bytes. Only a SHA-256 hash is kept (`worker_tokens`, migration 062). An admin makes and revokes
  them at `/admin/workers`; the list shows each one's name, what it may take, and when it was last used, never the token. At most
  20 in use. Revoking one stops it at once (the studio says so and stops) and puts what it was making back in the queue.
- **What a token can do** (every route is a POST with `Authorization: Bearer dsw_...`, checked by `requireWorker` first; the
  browser session is not accepted there, and `proxy.ts` lets `/api/worker/` through to that check):
  `hello` (on start: its own leftover jobs go back in the queue, old rows are swept, the reply says what it may take),
  `heartbeat` (awake, or `{ asleep: true }` when it stops), `pictures/claim`, `pictures/[id]/done` (the picture's bytes; checked by
  their first bytes, at most 1.5 MB), `pictures/[id]/failed` (a status number only: **the website chooses the words the person
  sees**, so a studio can never write to people), `companion/claim` and `companion/[id]/step` (see `docs/companion.md`).
- **Each job remembers which token claimed it** (`worker_id`), and a studio can only finish, fail or step its own jobs. Another
  studio starting does not take back jobs a different studio is making.
- **What a token cannot do:** read anyone's readings, journals or accounts, see other jobs, or change anything else. A picture
  token sees the words people typed for a picture (it has to, to draw them); a companion token sees the writing the companion is
  asked about, one model call at a time, so tick companion requests only for a computer you trust with everyone's words.
- **A circle's own picture computer (built 2026-10-17, migration 066, open item C3).** The owner of a circle adds a computer on the
  Circle page (up to 3 per circle). Its token has a `circle_id` and takes **only** the pictures asked for by members of that circle who
  agreed to use it (`claimNext(workerId, circleId)`); the app's own studio takes only the pictures of people with no circle computer, so
  neither can reach the other's queue. A circle token is for pictures only (a database check forbids companion requests, which carry
  people's own writing). Each job remembers its circle (`image_jobs.circle_id`); a person's pictures go to their circle's computer only
  if their circle has one that is not revoked **and** they agreed (the notice at joining, the button on the Circle page). Withdrawing,
  leaving, being removed, or the circle's last computer being removed gives up that person's waiting pictures with a plain sentence and
  gives back their day's count; so does handing the circle over (the computers are the old owner's and are revoked). A picture
  already being made is left to finish. The awake/asleep heartbeat is kept per circle (`settings` key `image_worker:circle:<id>`).
  **A circle's computer has no doorbell**: the owner's Redis is not shared, so it looks at its queue every `WORKER_IDLE_POLL_SECONDS`
  (default 600), and pictures can wait that long. Nothing else is different for the person who runs the studio: the same program, with the
  circle's token in `WORKER_TOKEN`.
- **Still global:** the app's own studio has one heartbeat and one doorbell list (that is fine: only the owner runs it). A tester's
  studio without the owner's `UPSTASH_REDIS_URL` still works, but only looks at the queue at its safety look.
- **If a studio is revoked while the website has no Redis,** the website keeps saying "awake" until that studio's last check-in
  is old (about 45 minutes at the default 30-minute look), because the revoked studio can no longer say it is going to sleep.
- **Checked 2026-10-16** against the dev branch with a production build, the real studio process (no `DATABASE_URL` in its
  environment), a stand-in image tool and companion model, and a local Redis 7: pictures made and collected, a failure shown in
  the website's words, a companion request answered in two model calls, the doorbell waking the studio within a second, a
  leftover job put back on start, revoking stopping the studio, and every wrong way in refused (no token, a made-up token, a
  browser session, a pictures-only token on a companion route, bytes that are not a picture, a job the token did not claim).
  The admin screen was click-tested at 1280 and 390 px. **Not tried:** the real KoboldCpp through the new path, the hosted site, Upstash.

## Keeping the free database asleep
Neon's free plan allows about 100 compute-hours a month (roughly 400 hours of the smallest size), and **stops the database
until next month when that runs out**, which would take the whole app down. Every query, including the studio looking at the
queue, keeps the database awake for 5 minutes. So the studio does not look every few seconds:
- **The Redis doorbell (built 2026-10-13).** Upstash Redis holds no data, only a note that says "look at the queue" (the list
  `ds:wake`) and a flag that says the studio is running (`ds:alive`, which expires 75 seconds after the studio stops renewing it).
  When someone asks for pictures, the website stores the job in the database as before, then (after replying) leaves a note in
  Redis (`lib/studio-signal.ts`, plain `fetch`, errors ignored). The studio on your PC keeps one connection **out** to Redis and
  waits for notes, so a picture starts within a second or two. The database is looked at only when a note comes, after a batch, and
  as a safety look every `WORKER_IDLE_POLL_SECONDS` (default 1800 with Redis, 600 without). Several notes close together make one
  look (at most one every 5 seconds). Notes left from before the studio started are thrown away; the first look sees everything.
- **If Redis is down or a note is lost,** nothing is lost: jobs wait safely in the database and the safety look (or the next
  start) picks them up. The studio logs "Redis is not answering" and "Redis is back".
- **Awake or asleep** on the page comes from `ds:alive` when the website has the Redis variables, so it turns to "asleep" within
  about a minute of closing the studio and asking costs the database nothing. Without them it uses the database heartbeat.
- **Where the three strings go (never in chat, never in git):** the hosted site: `UPSTASH_REDIS_REST_URL` (`https://....upstash.io`)
  and `UPSTASH_REDIS_REST_TOKEN`, then restart it once. `.env.local` on your PC: `UPSTASH_REDIS_URL=rediss://default:<password>@<host>:6379`
  (two s). Not in `.env.development.local`. Redis holds only `"1"`; a leaked token could only ring the doorbell.
- **Do not use Tailscale Funnel for this on the owner's machine** (decided 2026-10-13): Funnel only allows ports 443, 8443 and 10000,
  all three already carry `tailscale serve` mappings, and Funnel is switched on per port. Nothing on your PC listens for inbound
  connections now. (The old `--listen` / `WORKER_WAKE_URL` / `WORKER_WAKE_SECRET` wake call was removed.)
- Upstash's free plan allows 500,000 commands a month; the studio uses about 175,000 at worst (a wait and a flag renewal every
  30 seconds). Look at Upstash's usage graph after a day: it shows whether a waiting `BRPOP` counts once or each time.
- Watch Neon's "Usage" page for a week of beta use. If compute hours run short, upgrading the plan is the simple fix.

## Tailscale groups for each circle (asked by the owner, 2026-10-18; answered, not built)
The question: can each circle be confined to its own Tailscale group, under the circle owner's account?

- **Picture making is already confined per circle, and needs no tailnet.** A circle computer's token carries a `circle_id`,
  takes only the pictures asked for by members who agreed to use it, and the app's own studio takes nobody else's. The studio
  only calls out to the site; nothing on the PC listens.
- **A tailnet group cannot confine a request that comes from the hosted site.** A hosted site on a serverless platform cannot join
  a tailnet. Tailscale access rules (groups, tags) decide which *tailnet members* can reach which machine. The only way the
  hosted site can reach a PC is a public Funnel address, and anyone holding that address, with or without Tailscale, reaches it.
  So the boundary has to be made by the gateway itself: a signed request (the Funnel precautions in
  `docs/handoff-wave-5-pictures.md`), not by a group.
- **What does fit the question:** one tailnet per circle owner. Each circle owner who lends a PC uses their own Tailscale account,
  so their PC, their Funnel port and their access rules belong to them and to no other circle. Add one signing secret per
  circle (kept like the circle key, never shared between circles) and the circle id inside the signed claim, and the gateway
  refuses a request whose circle is not the one it serves. Within a tailnet, a tag such as `tag:ds-studio` on the PC lets the owner
  limit which of their own devices can open a Funnel (check the admin console's access-controls editor; not confirmed here).
- **A different reading:** members open the circle's pictures straight from the owner's PC over Tailscale, sharing the machine
  with each member's own Tailscale account. That is the only case where a tailnet group is the boundary. It needs every member
  to install Tailscale and accept a share, so it suits a small, close circle and not the housemates-first beta.
- **Pictures stay local only (owner, 2026-10-18).** Whichever computer made a picture keeps it; there is no object storage.
  `ART_REQUIRE_DISK=1` makes a hosted copy refuse to keep a picture when it has no art folder.
- **Not built.** It would be recorded as open item P2b in `docs/open-items.md`. Nothing here opens a port.

## Checked 2026-10-13
Against a throwaway local Postgres 16, the real studio process, and a stand-in image tool: turns alternate between people,
limits and refunds, a failing job is reported in plain words and refunded, a cancelled job is skipped, finished pictures reach
only their owner, old rows are swept, accounts take their jobs with them. Through a production build of the site: routes,
ownership, limits, the studio's awake/asleep state, and the admin controls. **Not yet tried:** the real KoboldCpp through the
studio, the hosted site, Neon, Upstash itself (the doorbell was tested against a local Redis 7), a phone, a screen reader.
