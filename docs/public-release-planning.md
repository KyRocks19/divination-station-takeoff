# Planning notes: a free, local, public release

**Written 2026-10-18 by a Claude session, at the owner's request, from a conversation about Tailscale and then about a public release.** These are planning notes and things found while reading the code, **not decisions**. Several recommendations have since been built or decided. Where a claim was checked it says so; where it comes from memory or a web page it says that too. Read `docs/security-audit.md` ("Before a public release") and `docs/open-items.md` first.

**Status correction:** several items in this plan have since been built or decided. The current remaining public-release work is tracked only in `docs/open-items.md` (ED12–ED20, O1–O12, and the relevant security/accessibility checks); use that file rather than the dated task order below for current status.

## The goal, in the owner's words

> "I need the most protection on divination-station as I want that to be a locally, freely distributed app which any computer can download, run, and save their data directly to their PC. [...] I don't want to be stuck with a huge bill from people fucking around with this app."

So two things must both be true: **a person's words stay on their own computer**, and **nobody else's use of the app can ever put a bill on the owner**. Today the app is the opposite on both counts: it is a hosted, multi-user app (Neon Postgres, Upstash, the owner's Anthropic key), built for a 50-person beta. The beta plan in `docs/security-audit.md` is sound for that; this file is about the next step.

## 1. Where the money can leak today (hosted version)

Everything below costs the owner money or can be used to cost the owner money. "Control" is what exists in the code today; "Add" is what to set outside the code. Dashboard features change, so verify each one in the current vendor docs before relying on it.

| Cost | Control in the code | Add (outside the code) |
| --- | --- | --- |
| **Anthropic API** (the only per-use cost) | `lib/ai-quota.ts`: 6 calls a minute, `AI_DAILY_LIMIT` (default 15) a day per person, `AI_GLOBAL_DAILY_LIMIT` (default 300) for everyone, `COMPANION_DAILY_LIMIT`, `IMAGE_DAILY_LIMIT`; joining is by invite code only | A monthly spend limit on the key's workspace in the Anthropic Console, a key used by the hosted app only (not the one in `.env.local` on the PC), a usage alert. Keep the global limit low. |
| **Neon** | Pictures can be kept on disk instead (`ART_DIR`, `ART_REQUIRE_DISK`, `ART_DB_BUDGET_MB`) so the database does not fill | Compute and storage caps on the project, a plan that stops rather than bills |
| **Upstash Redis** | Falls back to per-server counts if unset | A plan or cap that stops rather than bills |
| **Image and companion work** | Run on the owner's PC through the worker API (`docs/picture-queue.md`); cloud servers cannot reach it | Cost is electricity and the PC being on; keep workers token-only |

**What the local edition removes.** If the download runs on each person's own computer with their own database, there is no Neon or Upstash bill at all, and the Anthropic bill is theirs if (and only if) the Claude key is theirs. **The one rule that makes "no huge bill" true: the owner's own Anthropic key is never in the download, never in the repository, never in a release file.** A hosted copy, if one continues to exist, becomes a demo with its own tight limits (see section 6).

## 2. What a local edition changes (design points to decide)

`docs/security-audit.md` already lists three ways to keep words local (A: browser only, B: end-to-end encrypted on Neon, C: server keys plus a log) and `docs/open-items.md` Y1 asks which promise. **The owner's goal is a fourth: D, the whole app runs on the person's computer and the database is a file on their disk.** It is recorded as Y9 in `docs/open-items.md`, section C, next to Y1. It keeps the app's server-rendered design and the "words never leave this device unless you press a button" promise, with no sync between devices.

Points that the current code makes interesting:

- **The database is the big job.** The app uses `pg` and Postgres throughout: 72 migrations, and queries using `jsonb` (9 hits), `ILIKE` (7), `FOR UPDATE SKIP LOCKED` (1) and the `unaccent` extension (migration 072). A rewrite for SQLite touches migrations and most of the 130 routes. An embedded Postgres (for example PGlite, which runs Postgres in-process) would keep the SQL; **check its extension support (`unaccent`) and speed before committing to it**. Not tested here. Whichever is chosen: one migration path, run automatically at start, with a copy of the data file made first.
- **Single user is the normal case.** Circles, the forum, invites, the admin pages, worker tokens, "Claude tool" tokens and recovery codes are server-edition features. The local edition needs a "local mode" that hides or removes them rather than leaving half-working screens. First run should create the one account (or none, with an optional passphrase lock) instead of `ADMIN_USERNAME` / `ADMIN_INITIAL_PASSWORD` from the environment, and should generate `SESSION_SECRET` itself, once, into the data folder.
- **Claude: the person's own key, or no Claude.** Bring-your-own-key already has a pattern in the code: circle owners' keys are encrypted with AES-256-GCM (`lib/secret-box.ts`, `lib/circle-claude.ts`, `lib/claude-access.ts`) and never sent back to a browser. Reuse it, with the master key generated on first run and kept in the data folder or the operating system's keychain. The local-model route also exists (`KOBOLDCPP_URL`, `COMPANION_URL`, `IMAGE_GEN_URL`). **Keep these addresses environment-only (settings the person makes on their own machine), never typed into a form by a signed-in user**: that is what keeps the server from being pointed at other addresses (`docs/security-audit.md`, "Pictures"). Do not add a "custom Anthropic base URL" field for the same reason.
- **The limits become a safety net for the person's own wallet,** not for the owner's. Keep per-minute and daily limits, default lower, and show plainly what a request may cost.
- **Redis is not needed locally.** The limiters already count per server when Redis is not set up.
- **The picture studio.** It is already a local program. In a local edition the app and the image tool are on the same computer, which is the easy case; `docs/picture-model-at-home.md` is the newcomer's guide that the audit asked for.

## 3. Making it downloadable and runnable (to evaluate, not chosen)

- **Packaging.** Options: an installer with a bundled Node and `next start` (Next's "standalone" output), a desktop shell (Electron or Tauri), or Docker. Docker is easy for developers and a poor fit for people who want to download an app. `sharp` ships native binaries per operating system and chip, so each target needs its own build. Windows and macOS warn about unsigned programs; signing costs money and time. Decide which operating systems are in scope first.
- **Updates.** The app must be updatable: the 2026-10-16 audit found 30 published advisories on the Next.js then in use, including a critical remote-code-execution bug on Windows-hosted servers. A locally run copy that nobody can update is a risk to its owner. Plan an update check and a clear "how to update" path, and publish checksums with every release.
- **Where the data lives.** In the operating system's per-user data folder (not the install folder, so an update never touches it), with the pictures folder (`ART_DIR`) beside it. `docs/backups.md` and `scripts/backup-db.ts` read `DATABASE_URL` and a Neon database; they need a local equivalent, plus an obvious "back up now" and "restore" in Settings. The existing export (`/api/export`) is the person's own copy and should keep working.
- **Seed data.** `SEED_DATA_DIR` and the `data/*.txt` archetype files are read by scripts today. A first run must seed itself with no developer tools.
- **A port that is not in the way.** Pick an uncommon default, fall back to the next free port, and always bind `127.0.0.1` only (the `dev` and `start` scripts already do). Do not use a port on Chrome's blocked list.
- **`.env.example` is missing.** The README tells people to `copy .env.example .env.local`, but there is no such file, and `.gitignore` has `.env*`, which would ignore it too. Add the file and an exception (`!.env.example`). A local edition should not need an `.env` file at all.

## 4. Security necessities that are specific to a local app

A server on a person's own computer can be attacked from any website they visit. These are findings from reading the code, not tested:

1. **DNS rebinding.** `lib/origin.ts` accepts a write whose `Origin` host equals the request's own `Host` header (`ownHosts` adds the `Host` and `X-Forwarded-Host` headers to the allowed set). A page on an attacker's domain that re-points its name at `127.0.0.1` would send a request whose `Origin` and `Host` are both the attacker's name, so it would pass. Add a **Host allowlist** (`localhost`, `127.0.0.1`, `[::1]` and the port, plus hosts the person sets, for example a Tailscale name) and refuse everything else with a plain message. Without this, "bound to loopback" is not enough.
2. **Requests with no `Origin` pass** (`originAllowed` returns true). That is deliberate for tokens and scripts; with the Host allowlist and `SameSite=Lax` cookies it is acceptable, but test a cross-site form post against a local build.
3. **A secret per install.** Never ship one `SESSION_SECRET`, circle key or admin password; generate them on first run. Check that no default password exists in any seed or script.
4. **Nothing phones home.** No analytics, no error reporting, no update ping that carries data. Say so in the privacy notice and keep it true.
5. **Keep the strict page policy** (nonce, no `'unsafe-inline'`, done 2026-10-17), the sniffed uploads (SVG refused), and the art-folder path checks. Re-run `client-safety-check` and `new-api-route` on anything added.
6. **Supply chain.** Keep the lockfile, the Actions pinned to commit SHAs and Dependabot (all in place). Add release signing or at least published checksums. Do not add a dependency that runs code on install.
7. **Phone access to a local copy.** The owner reaches their own copy by Tailscale Serve (section 5). Document it as optional, and make sure the Host allowlist can be told about the person's tailnet name.

## 5. Tailscale: what was learned (2026-10-18, on the owner's PC, `tailscale` 1.102.2, Windows)

Context: this app is reached from the owner's phone at `https://your-pc.your-tailnet.ts.net:10000`, which `tailscale serve` maps to `http://localhost:3000` (`docs/security-audit.md`, before-the-beta item 3). The sibling **bank app** (`coven-of-nance-bank-ui`, Flask, port 5000) moved from `:8443` to `:9443`, and Nextcloud is on `:443` (Apache on 11000). Facts that matter here:

- **The 443 / 8443 / 10000 limit belongs to Tailscale Funnel (public), not Serve (tailnet only).** `tailscale serve --https=9443` worked on this PC. Serve ports can be chosen freely; only Funnel is limited. (Tailscale's Funnel reference; the Serve behaviour was confirmed by running it.)
- **Never use Funnel for the owner's own copy of this app.** It would put the owner's PC, and the live database behind it, on the public internet. The audit's Next.js Windows advisory is exactly the risk.
- **Browsers share cookies across ports.** All apps on `your-pc.your-tailnet.ts.net` share one cookie jar. This app's cookie is `tarot_session` (`lib/session-options.ts`), the bank app's is `__Host-coven`, Nextcloud's is `oc_sessionPassphrase` (seen live) plus its own: no collisions as of 2026-10-18. **Never name this app's cookie something generic** (`session`, `token`), and note the cookie is also sent to the other apps' ports, so a bug or log line in a sibling app can see it.
- **Tailscale Services give an app its own hostname** (for example `https://divination.your-tailnet.ts.net`, plain port 443, its own cookie jar). Services are generally available (announced 2026-02-19), on all plans, up to 10 on Personal, and need **client 1.94.1 or later**. **The host machine must use a tag identity, not a user identity**, so the PC has to be tagged. One tagged PC can host many Services; a tag is a machine label, not tied to one app. Policy needs a `tagOwners` entry, a grant for `svc:<name>`, and optionally an `autoApprovers.services` entry. (Tailscale's Services pages.)
- **`tailscale set` has no `--advertise-tags`** in this version. Tag a machine from the admin console (Machines, the machine's menu, "Edit ACL tags") after the tag is in `tagOwners`.
- **The owner's access policy is the default allow-all** (`*` to `*`, all ports; seen in the admin console 2026-10-18), so tagging the PC does not cut anyone off. Tightening it later is a separate job.
- **Status when this was written:** the owner was setting up `svc:coven` for the bank app with the tag `tag:nancey-server`. Whether it is finished, and whether `svc:divination` was added, is **not known from the code**: check `tailscale serve status` and the admin console before assuming. Moving this app from `:10000` to its own Service is optional and only changes the owner's own access.
- **Tailscale is not a distribution mechanism.** A free download runs on each person's computer. Tailscale only lets the owner (and invited people) reach the owner's own instance, or lets a downloader reach their own copy from their phone.

## 6. If a hosted copy continues

- Make it a **demo or the owner's household copy**, not the place strangers keep their writing. Keep joining by invite code, keep `AI_GLOBAL_DAILY_LIMIT` low, and consider Claude switched off for everyone but the owner.
- Set the vendor-side limits in section 1 before any public link exists, and use a key and a Console workspace that exist only for it.
- Keep the picture and companion workers token-only, one circle each. Do not point public traffic at the owner's PC.
- `docs/beta-tester-notice.md` says the owner can read the database. That stays true for any hosted copy, and is the reason words-on-their-own-computer matters (Y1 B and D).

## 7. Before the repository or a download goes public

- **Licence.** There is no `LICENSE` file. The owner must choose one (a decision, with consequences for contributors and for copies). It covers code only: **audit and record the origin of everything in `data/` and `public/`** (archetype and meaning texts, the webliography, any pictures, the bundled fonts) and keep a provenance note.
- **History and secrets.** The audit found an old committed `.env` swap file (Vim's header only, no values) and noted the keys owed rotation between 1 and 12 November. Before the repository is made public, run a secret scanner over the **whole git history**, rotate every key that has ever been in a terminal or chat (Anthropic, Neon, Upstash, `SESSION_SECRET`, `CIRCLE_KEY_SECRET`), and consider publishing from a fresh history.
- **Personal material.** Remove or rewrite what is the owner's rather than the project's: the handoff notes (`docs/handoff-*.md`), test-account names, the default admin username in the README, the tailnet hostname in docs, and review what `.claude/` should contain in a public copy.
- **Words people will read.** A new privacy notice that is true for a local app (what stays on the device, that Claude buttons send the words involved to Anthropic under the person's own key, that nothing is collected by the owner), terms and a plain "this is for reflection, not medical, mental-health, legal or financial advice", a minimum age, and a re-check of the AI companion's safety behaviour (`lib/companion-safety.ts`, `companion-privacy-audit`). Check Anthropic's current usage terms for people who bring their own key. Run `copy-check` on every new line. Legal review is the owner's step.
- **Accessibility is a strength, so keep it.** NVDA and the `accessibility-pass` skill have been run on the screens; the local edition's first-run, key and backup screens need the same pass.

## 8. A suggested order (sizes as in the audit: S an hour or two, M a session, L several)

1. **Decide the promise (the owner).** Add D to Y1; choose D, or B for a hosted copy. Nothing below should start before this.
2. **Spend safety now (S, owner).** The vendor-side caps in section 1, and a key that exists only for the hosted app.
3. **Host allowlist and a cross-site test (S).** Section 4, item 1. Useful for the PC copy today, whatever is decided.
4. **`.env.example` and a README that works on a clean machine (S).**
5. **Prototype the local database (M).** One embedded-Postgres or SQLite spike that runs all migrations and the test suite; decide from the result.
6. **Local mode (L).** First-run set-up, generated secrets, the server-only features hidden, backup and restore in Settings.
7. **Bring-your-own-key and the local model path (M).** Reuse the secret box; lower default limits.
8. **Packaging, signing and updates (L).**
9. **Repository clean-up, licence, scanner, rotated keys, new privacy and terms (M, mostly the owner).**
10. **Re-run the audit** (`docs/security-audit.md`) against the local build, including the browser and NVDA checks that were never run on a real phone.

## What was and was not checked for these notes

- **Read:** `AGENTS.md`, `package.json`, `README.md`, `docs/security-audit.md`, `docs/open-items.md` (head and section C), `docs/backups.md`, `docs/beta-tester-notice.md`, `lib/ai-quota.ts`, `lib/origin.ts`, `lib/session-options.ts`, `proxy.ts` (origin check), the `process.env` names used across the code, and the **names only** (never the values) of the variables in the `.env*` files.
- **Not run:** the app, its tests, a build, an embedded database, a rebinding attack, a secret scan, or any vendor dashboard. The spend controls in section 1 are from general knowledge of those services, not from the owner's accounts.
- **Counts** of Postgres features are from a text search and are indicative only.
