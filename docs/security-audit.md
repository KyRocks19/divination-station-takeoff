# Security audit and hardening plan

**Written 2026-10-16 by Claude, for the 50-tester beta and the later public release.** Branch `feature/accessibility-pass-alpha`, commits `6f95152` (fixes) and `2857376` (dependency upgrade). Update this file as items are done; do not delete finished items, mark them DONE with the date.

**Status note 2026-10-18:** this is the historical hardening plan and audit evidence. Its old status paragraph is superseded; current security-related open work and owner actions are S10, ED12, O1, O5–O7, and E9 in `docs/open-items.md`. The Vercel firewall rule and recovery-code prompt were reported done; current deployment and live-database state were not verified in this session.

## The short answer

The app was already built carefully. Every API route checks who is asking and only touches that person's rows; SQL is always parameterised (no injection found); passwords are bcrypt with a sign-in limit per address and per username; invite codes are single-use and stored hashed; uploads are sniffed by their bytes and SVG is refused; stored picture keys cannot point outside the art folder; the AI routes all go through the daily quota; the security headers were already good. The privacy notice tells the truth about what the owner can see.

**Two real problems were found and fixed today, plus several small ones.** After the owner does the five steps in "Before the beta" below, the app is fit for 50 invited testers. It is **not** yet fit for strangers on the open internet: see "Before a public release".

## What was checked

- All 130 API routes: a sign-in check in every handler, an ownership check on every read, change, and delete (every `UPDATE` and `DELETE` without `user_id` was read by hand), admin-only routes, the Claude tool-key routes.
- Sign-in, joining with a code, sessions (iron-session cookie, `session_version` after a password change, switched-off accounts), the Origin check against cross-site requests, body-size and write limits in `proxy.ts`.
- Pictures: upload checks, the art folder, thumbnails, the image tool and companion addresses (environment only, so the server cannot be pointed at another address by a person).
- Places where text becomes HTML (only the reading-comfort boot script, which holds no user text), the forum, the sigil.
- The AI routes: quota, input size limits, what each one sends.
- The service worker, the security headers on the live Vercel site, secrets in the git history (one committed `.env` swap file from April holds only Vim's header, no values; the repository is private), and `npm audit`.

## Fixed today

| What | Why it mattered | Commit |
| --- | --- | --- |
| **Next.js 16.2.4 to 16.3.8** | 30 published advisories, including several ways round `proxy.ts` (the sign-in gate), a critical remote-code-execution bug on **Windows-hosted servers** (the owner's PC serves the app), and server-side request forgery. 16.4.2 existed but was one day old; 16.3.8 fixes every advisory listed. | `2857376` |
| **sharp 0.34 to 0.35.5** | sharp decodes every uploaded picture; the old one carried known bugs in libvips, libheif and librsvg. `npm audit fix` also updated nanoid, source-map-js and baseline-browser-mapping. | `2857376` |
| **The service worker stored private pages** | When it installed, it saved copies of `/`, `/readings`, `/spreads` and `/journals` as they looked for whoever was signed in, and showed them when offline, even after sign-out. On a computer shared in a house, the next person could see them. Now it stores only the card pictures, and its new name deletes the old copies. | `6f95152` |
| Sign-in checks in six handlers | `clarifier`, `interview`, `synthesize`, `guide`, `insights/pattern` and `draw` relied on `proxy.ts` alone. No data could leak (their queries matched no rows), but with a proxy bypass they would run. `tests/route-auth.test.ts` now fails for any handler without its own check. | `6f95152` |
| Ask read hidden forum posts | A post hidden after reports could still be sent to Claude by anyone who knew its number. | `6f95152` |
| Headers | `Permissions-Policy` (camera, microphone, location and the rest off), `Cross-Origin-Opener-Policy`, no `X-Powered-By`; the CSP gains `base-uri`, `form-action`, `object-src`. | `6f95152` |
| Password hashing | Was synchronous, so a burst of sign-ins stalled every other request for a quarter second each. | `6f95152` |
| Admin-made accounts | Skipped the username rules and could repeat a name in other capitals ("Kylie" and "kylie"). | `6f95152` |
| Clarifier input | `card_index` was not checked (a crash, not a leak). | `6f95152` |

Checked: `tsc`, `npm test` (302), `npm run build` with no warnings, production servers on the dev branch (headers, sign-in right and wrong, every main page, cross-site POST refused, an uploaded PNG stored and its WebP preview made by the new sharp, SVG refused). **Not checked:** a browser that already has the old service worker swapping to the new one (it should, by the browser's own rules), and the Playwright and NVDA suites on the new Next.js.

## Before the beta (the owner's steps)

1. **DONE (checked 2026-10-17: `node_modules` has Next.js 16.4.2).** Install the upgrade on your PC: stop your dev server, run `npm install`, start it again.
2. **Deploy the upgrade to Vercel.** The upgrade is merged into `origin/main` (pull requests #5 and #6 on 2026-10-16; `main` is on Next.js 16.4.2). Whether Vercel has deployed it is not known from the repository: check the deployment.
3. **DONE 2026-10-16 (the user uses Tailscale on their phone): `npm run dev` and `npm start` now listen on 127.0.0.1 only; `tailscale serve` proxies `https://my-pc.tail1234.ts.net:10000 (the tailnet address)` to `http://localhost:3000`, so the phone still works. Checked on a side port: answers on localhost, refused on the Wi-Fi address and the raw Tailscale address. Takes effect when the dev server is restarted.** Was: **Do not let the PC serve the app to the whole network.** `npm run dev` and `npm start` listen on every network address of the PC (`0.0.0.0:3000`), so anyone on the house Wi-Fi can reach it unless Windows Firewall blocks the port, and the Windows bug above was exactly about that. `tailscale serve` reaches the app through `localhost`, so binding to `127.0.0.1` keeps Tailscale working and shuts out the Wi-Fi. (Claude did not change the `start` script: say if you use the PC's Wi-Fi address on purpose, for example from a phone.)
4. **Make your own Claude tool token in Settings and then remove the shared key (S2 is built).** Until then, keep the shared Claude tool key to yourself. `CLAUDE_API_KEY` with an `x-claude-user` header can read and write the readings of every account that has "Claude tool access" switched on. Switch it on only for your own account.
5. **Things already owed** (from the handoff): the live migrations (done: live is at 063 as of 2026-10-17; 064 is new) and the 059 seed (unverified); rotating both Anthropic keys between 1 and 12 November; a test restore of a backup into a fresh Neon branch.

## Before a public release (the hardening plan, in a suggested order)

Each item is a slice of its own. Sizes: S (an hour or two), M (a session), L (several sessions).

1. **CI on GitHub (S).** A GitHub Actions job running `tsc`, `npm test`, `npm run build` and `npm audit --omit=dev` on every push, plus Dependabot for security updates. Today an advisory like the Next.js ones is only found when someone looks.
   **DONE 2026-10-16** (it runs on GitHub and passed on `main` on 2026-10-17): `.github/workflows/ci.yml` (typecheck, tests and build in one job; `npm audit --omit=dev --audit-level=high` in a second job; also weekly on Mondays; no secrets, no database) and `.github/dependabot.yml` (grouped npm security fixes, monthly action updates). Actions pinned to commit SHAs. Dependabot is working (pull requests #3, #5, #7 and #8 came from it). See "Continuous checks" in `README.md`.
2. **DONE 2026-10-16 (dev branch; migration 062 owed to live). The picture worker must stop holding the database password (M, and needed before anyone else runs a worker).** `scripts/image-worker.ts` connected with `DATABASE_URL`, which can read and change everyone's writing. That is fine on the owner's PC; it is not fine for a tester's PC. Replace it with a small worker API (claim a job, send back a picture) and a per-worker token that can only do that. This blocks the newcomer image guide and Circles below. **Built:** the studio now needs only `APP_URL` and `WORKER_TOKEN`; tokens are made and revoked at `/admin/workers` (only a SHA-256 hash is kept); a token may take pictures, companion requests, or both (companion off by default); each job records the token that claimed it, and a token can only finish, fail or step its own jobs; the website chooses every word a person sees, and the companion's safety checks stay on the website (the studio only runs model calls). Details and what is still global (one queue, one heartbeat, one doorbell): `docs/picture-queue.md`, "The worker API and its tokens". **The owner's steps:** migration 062 on live, make a token at `/admin/workers`, add `APP_URL` and `WORKER_TOKEN` to the PC's `.env.local`, restart the studio.
3. **DONE 2026-10-17 (the firewall rule is still the owner's step: see `docs/open-items.md` section D). Limits that hold across servers (S).** The write limit and Claude's per-minute limit are counted in each server's memory; on Vercel each instance counts separately. Move them to the Upstash Redis you already have. Add Vercel's firewall rate limit on `/api/auth/*`.
4. **DONE 2026-10-17 (migration 070, dev branch).** **Per-person tokens instead of the shared Claude key (M).** Each person makes, names, and revokes their own token in Settings; only a hash is stored.
5. **DONE 2026-10-17.** **Delete my account, by the person themselves (S).** Today they ask the owner. A button in Settings, with the password asked again, calling the existing `deleteUser`.
6. **DONE 2026-10-17 (no `'unsafe-inline'` anywhere in production: scripts and `<style>` elements need the nonce and style attributes are refused; the app's 125 style attributes were converted, see `docs/design-system.md` rule 5).** **A stricter page policy (M).** The CSP still allows inline scripts (`'unsafe-inline'`). Next.js 16 can stamp a nonce per request from `proxy.ts`; with it, an injected script cannot run.
7. **DONE 2026-10-17 except passkeys (S10) (migration 069, dev branch; sessions now 14 days).** **Account recovery and stronger sign-in (M to L).** No email today, so only the owner can reset a password. For strangers: recovery codes made at sign-up, or email; optional passkeys. "Sign out everywhere" in Settings. Consider a shorter session than 30 days.
8. **DONE 2026-10-17 (migration 068, dev branch).** **A log of admin actions (S).** Password resets, switch-offs, deletions, and report decisions, with who and when, readable on `/admin`.
9. **DONE 2026-10-17, in code: the app rewrites the mode, no edit to your `.env` files.** **Database connection (S).** Write `sslmode=verify-full` in both `DATABASE_URL`s; `pg` warns that the meaning of `require` will change in its next major version. The code already verifies the certificate (`lib/db-ssl.ts`); only the text of the two URLs is left.
10. **DONE 2026-10-17 (older posts still read the original).** **Forum attachments (S).** A shared journal entry is read live, so editing it later changes what others see; readings are already frozen at posting. Freeze journals the same way.
11. **DONE 2026-10-17 (migration 067; no duplicates on dev or live).** **Usernames ignore capitals at sign-in (S).** Joining already treats "Kylie" and "kylie" as the same; sign-in does not. Needs a check that no two accounts differ only by capitals first.
12. **Where people's words live (L, a decision first).** See "Local-first storage" below.
13. **Legal and age (owner).** For strangers: a reviewed privacy policy and terms, a minimum age, and what to do for a request under GDPR or CCPA.

Smaller notes, no slice needed yet: other people's forum posts can be passed to Claude through Ask, so a post could try to steer Claude's answer (low impact: Claude only writes text back, it has no tools here); the Anthropic SDK has a moderate advisory in its file-memory tool, which this app does not use; the remaining `npm audit` items are build-time only.

## The owner's four to-dos, seen from the security side

**Circles (one person's Claude key and picture computer serving their group).** *The core (circles, single-use codes, members, hand-over) is built (2026-10-16, migration 063, merged). The four points below were built on 2026-10-17 (local, migrations 065 and 066): the key (`lib/secret-box.ts`, `lib/circle-claude.ts`, `lib/claude-access.ts`), the notice and the agreement (`SHARING_NOTICE`), the quotas (`takeCircleCall`), and the circle's picture queue and tokens (`image_jobs.circle_id`, `worker_tokens.circle_id`). Still to check by a person: a real key and a real studio through a circle.*
- A key a person brings must be stored encrypted (AES-256-GCM, with the master key only in the server's environment), never sent back to any browser (show the last four characters), and usable only for members of that circle.
- Every member should see, before joining, that their words go to the key holder's Anthropic account and their picture prompts to the host's computer, and should be able to leave at any time.
- Quotas per circle as well as per person, so one member cannot spend the holder's money.
- The picture queue needs a circle on each job, and each host's worker a token for its own circle only (plan item 2).

**A newcomer's guide to running pictures at home.** Worth doing, after plan item 2, so no tester ever receives the database password. The guide should cover: KoboldCpp (one program, works on AMD and NVIDIA through Vulkan), one Stable Diffusion 1.5 model such as DreamShaper 8, **`.safetensors` files only** (a `.ckpt` or `.pt` file can run hidden code when loaded; `scripts/pt-to-safetensors.py` exists for the owner), the minimum graphics card, and `start-picture-studio.cmd`.

**Local-first storage (people's words on their own machine by default).** This is the biggest change of the four: nearly every one of the 130 routes reads or writes people's words, Patterns and search are worked out on the server, and AI buttons need the words on the server for a moment anyway. Three ways, each with a different promise:
- **A. Words only in the browser** (IndexedDB, with an optional folder through the folder picker the Days page already uses). Promise: "your words never leave this device unless you press a button". Costs: no sync between phone and computer; clearing the browser loses everything unless backed up; the folder picker works in Chrome and Edge on a computer but not in Safari, Firefox or on iPhones.
- **B. End-to-end encrypted on Neon.** Words are locked in the browser with a key from the person's own passphrase; the server holds only locked text. Promise: "the owner cannot read your words". Sync keeps working. Cost: a forgotten passphrase means lost writing, and search and Patterns move into the browser.
- **C. Keep the server, add locks and a log.** Encryption at rest with server keys plus a log of every time the owner opens anyone's writing. Smallest, but the owner could still read.
Since the first users share a house with the owner, B may be the promise that matters most. Decide which promise first; Claude would plan it as its own project after the beta.

**Interviewer for every reading type; remove Sword: DONE 2026-10-17 (`fbb10d6`).** `app/api/interview` takes `divination_id` for every kind but tarot and sends Claude only the person's own words; the Sword route and button are removed and old entries read "Earlier AI entry".
