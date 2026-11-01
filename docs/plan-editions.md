# Plan: a hosted "lite" edition and a downloadable "full" edition (Y1 and Y9)

**Written 2026-10-18 by a Claude session, from the owner's decision of the same day.** The decision is the owner's; the challenges, defaults and order below are Claude's proposals, each with a reason, for the owner to change. Read with `docs/public-release-planning.md` (spend, packaging, local-app security) and `docs/security-audit.md`.

**Current status:** follow the open-only list in `docs/open-items.md`. The completion/status text in this plan is a dated planning record, not a second current backlog.

## The decision, in the owner's words

> An online "lite" version of the app, reachable from a browser, and a downloadable "heavy" version which only circle leaders (people with picture-ready PCs) need to download in order to offer their machines to their friends; anyone else can download it too if they want a local-only app. Everyone still needs to be part of a circle to use anyone else's PC resources or view forums. Anything given to free users should be robust as well.

Recorded as the answer to **Y1 and Y9**. The pieces that are not in dispute:

1. Two editions of one codebase: **lite** (hosted, in a browser) and **full** (runs on the person's own computer).
2. Pictures made on someone else's PC, and the forum, exist **only inside a circle**.
3. A person with no circle still has a complete personal app. Nothing a person writes for themselves is held back to push them into a circle.

## Updated hosted boundary (2026-10-20)

The owner chose to limit the hosted production app to **one configured family circle**. Everyone currently using the app is already in that circle, so the change does not remove anyone's current access. People outside that circle use the existing full local edition with PGlite; a browser-only IndexedDB edition is not planned. Existing hosted rows are preserved and are not automatically deleted or moved.

Set `DS_FAMILY_CIRCLE_ID` to the family circle's numeric database ID wherever the hosted app runs. Production builds fail closed if the setting is missing or invalid. The check covers ordinary signed-in pages and APIs, sign-in, circle-code account creation, Claude tool tokens, and picture-computer tokens. Local PGlite editions ignore this setting. Existing members keep their access; the hosted join page accepts only a code for the configured circle.

This updates the hosted audience from the original Y1/Y9 proposal. The local edition remains a separate app on the person's own computer; there is no local-to-hosted circle link in this model.

## Decided 2026-10-21 (distribution, circles, pictures)

The owner decided, in chat:
1. **No code signing.** Downloads are unsigned and go out in small communities through **itch.io**. The download page says so and publishes a checksum.
2. **Packaging is a portable folder with `start-divination-station.bat`**, plus a **Docker** option. One standalone build serves both (`scripts/build-local-package.ts`, `Dockerfile`, `docker-compose.yml`). Electron/Tauri installers and a single-file program are not planned.
3. **Circles are guided to use Tailscale**: the leader runs a copy and shares it with friends through Tailscale, in circles of **5 to 10 people**. Per-circle Funnel ports on picture PCs (P2b) are not wanted. Host mode is **not built**; the design and what it needs are in `docs/setup-guide.md` Part 3. It changes the 2026-10-20 rule that local copies do not connect to circles; decided the same day (H1): host mode sits beside the hosted family circle, which is unchanged. The plan is `docs/plan-host-mode.md`.
4. **All user pictures live on the user's machine** where possible (`ART_DIR` in the portable folder and the Docker volume). The hosted database stays as a **bridge for people without circles, with stricter limits** (a smaller `ART_DB_BUDGET_MB` and account cap).
5. **Concepts and the tarot** (X4): concepts get a realm of their own; tarot and the other tools reach parity in structure and function; the forfeda wording is parked.

## Where the idea is good, and where it needs changing

**Good.** Circles already exist (migrations 063, 065, 066): one owner, up to 30 people, one circle each, an owner's Claude key, a circle's own picture computer that takes only that circle's pictures, and a notice that must be ticked. The unit of growth and the unit of accountability are the same thing, which is what keeps the owner's bill and the owner's moderation job bounded. Keep that.

**Challenge 1: the "heavy" download does two different jobs, and only one of them needs a big program.**
- *Lending a PC for pictures* is already a small program: `scripts/image-worker.ts` needs only `APP_URL` and `WORKER_TOKEN`, makes only outbound requests, and holds no database password. A circle leader should not have to install and understand the whole app to do that.
- *A local-only copy of the whole app* is the large job (the database, first run, backups, packaging, updates).

Recommendation: **three things, built in this order**: (1) the lite edition, hardened; (2) a small **Picture Studio** download for lenders (worker, a guide, a "test it" screen); (3) the **full local edition**. A leader gets value after step 2, not after the biggest step. Anyone who wants the full app can wait for step 3.

**Challenge 2 (updated 2026-10-20):** The owner chose not to connect local-only accounts to circles. The hosted app is the circle experience for members of the configured family circle; people outside it use the separate PGlite local edition. The previously proposed local circle link is not part of the current plan.

**Challenge 3: lite is not free for the owner, it is capped.** Neon and Upstash are the owner's bill. The decision "free users are robust" is affordable only with ceilings set outside the code (spend limits, section 1 of `public-release-planning.md`) and inside it (accounts, storage, pictures, Claude). The defaults below are those ceilings. Without them, "robust" and "no huge bill" pull against each other.

**Challenge 4: who can create an account?** Circle codes can make an account and join the circle in one step, under the existing global and per-circle account limits. Under the updated hosted boundary, only a code for the configured family circle is accepted on hosted production; ordinary app invite codes do not create hosted accounts there.

**Challenge 5: Y1 option B (end-to-end encryption on the server) should be dropped.** Search, Patterns, the day pages, the companion, "Ask" and the forum snapshots all run SQL over the person's plain words. Encrypting them would mean rewriting each of those, and it would still leave the lite edition slower and the code harder to reason about. The honest alternative is already in the decision: **lite is promise C** (the host can read what is stored, and the app says so in plain words on the sign-up page and the privacy text), **full is promise D** (nothing leaves the computer unless a button says so). People who want privacy choose full. This is also simpler to explain.

**Challenge 6: lending a PC is lending it to other people's words.** A friend's picture prompt runs on the leader's graphics card, and a prompt can ask for something the leader does not want made. Recommendation: per-person and per-circle limits, a short prompt, a pause switch, and the leader can see the requests waiting (the sharing notice already says the leader's PC receives the words). Pictures a friend asks for are returned to the friend and not kept on the leader's disk by the Studio. The hosted server keeps them for a short time only (below).

**Challenge 7: moderation has to move with the forum.** One owner cannot moderate every circle. When the forum is circle-only, the **leader** is the first moderator (can remove a post, comment or member in their circle); reports go to the leader first; the app's owner keeps the last say. Also: the current rule hides something after 5 different people report it, which can **never** happen in a circle of fewer than six people. The threshold must depend on the circle's size (below).

**Challenge 8: two editions need one codebase and one rule.** Use one flag (`DS_EDITION=hosted|local`, default `hosted`) read by one file, and make every feature say which edition it belongs to. Without that, the editions drift and every bug is fixed twice. The Settings export/import remains the way to move hosted data to a local edition. The reverse (full to hosted) is not planned.

**Challenge 9: updates and compatibility.** A downloaded app that nobody can update is a risk to its owner (the 2026-10-16 audit found 30 advisories on one Next.js version). A check for a new version is **off by default** and asks first, because "nothing phones home" is a promise the full edition makes. The previously proposed circle-link version handshake is not needed under the updated hosted boundary.

## Decided 2026-10-18: young-folk mode (age, option B)

After the research in `docs/research-minimum-age.md` the owner decided: **the full local edition has a young-folk mode.** There is **no age question and no age floor** on the local edition. In young-folk mode these are absent, not hidden behind a switch: accounts, the forum, the circle link, every Claude feature (chat, interviewer, companion), and pictures made on someone else's PC. The person's words stay on the computer; nothing is sent anywhere, so the operator collects nothing (the FTC says an app that never transmits what is on the device is not collecting it). The wording is plain and never reproachful, and the app does not nudge, track or profile. It is a setting of the local edition, not a second app, so it is built with the local edition (steps 8 and 9). **Hosted minimum, decided later the same day (Y10): 13 and over for the first release**, worded as "younger people: use the downloadable app". Option A (no floor on the hosted copy) stays possible later: `docs/plan-no-age-floor.md` lists what it would take and covers a forum on a separate website.

## Sane defaults

"Default" means what a new copy does without anyone choosing. Every number is a proposal; those marked **(code today)** already exist.

### Accounts and circles (lite)
| Setting | Default | Why |
|---|---|---|
| Who can make an account | Only with a code (an app invite today; a circle code too, once Challenge 4 is built) | Cost and abuse are bounded by whoever holds codes. |
| `MAX_ACCOUNTS` | 200 | Past this, new codes say "this copy is full"; the owner raises it when the bill is understood. |
| Who can make a circle | Only people an admin switches on **(code today)** | The owner knows every leader at first. |
| Circle size, waiting codes, computers | 30, 10, 3 **(code today)** | |
| Minimum age | **None on the full local edition** (it collects nothing and asks no age). For hosted accounts and the forum: **13 and over**, decided 2026-10-18 for the first release, stated and not asked, with a message pointing younger people to the downloadable app (`docs/plan-no-age-floor.md`; the 16 first proposed here was a placeholder and is withdrawn) | A minimum age protects the operator from child-privacy duties; it is not a child-rights principle. Collecting less does the same without excluding anyone. |
| Dormant accounts | Never deleted by the app | The app has no email to warn people; deleting someone's words silently is worse than a row of storage. |

### What a free lite account may keep
| Setting | Default | Why |
|---|---|---|
| Pictures | 25 MB per account, 600 KB per picture (the studio already makes 1024 pixels or less), over the limit the person downloads and deletes | Pictures are the one thing that can fill Neon quickly (`ART_DB_BUDGET_MB` is the global brake **(code today)**). |
| Pictures requested from a circle PC | 10 a day per member **(code today: 30; lower for lite)**, 5 waiting at once per member, 30 waiting per circle, a request lives 24 hours **(code today)** | A leader's card is small. |
| Prompt length for pictures | Today 1,000 characters for the scene and 500 for the style note; the owner (2026-10-21) wants as much room as is practical, so the limits go up, not down (open item PIC1) | A 500 limit would cut text the app itself builds. |
| Text | Sizes per item already capped **(code today)**; add a per-account row count later if the bill needs it | |
| Claude on lite | **Off** for everyone except a circle that has its leader's key, or a person with their own token **(code today)**. The owner's key is only for accounts an admin switches on | The owner's key is the one bill that scales with use. |
| Circle Claude limits | 15 a day per member, 100 a day per circle **(code today)** | |
| Writes | 90 a minute **(code today)** | |

### The forum (circle only)
| Setting | Default | Why |
|---|---|---|
| Who can read or post | Members of the same circle; nobody outside it, including a person with no circle | The decision. |
| Existing posts | Move to their author's circle at migration; an author with no circle keeps their post private to themselves | Nothing is lost, nothing leaks. |
| Leader may | Remove a post or comment in their circle, remove a member | First moderator. |
| Hide after N different reporters | `clamp(ceil(members / 4), 2, 5)` | 5 is unreachable in a small circle. |
| Posts per person per day | 20; comments 60 | A flood brake that a human never meets. |

### The full local edition
| Setting | Default | Why |
|---|---|---|
| Where it listens | `127.0.0.1` only, an uncommon port (47831; the next free one if taken), never a port on Chrome's blocked list | Nothing on the network can reach it. |
| Allowed `Host` names | `localhost`, `127.0.0.1`, `[::1]` with the port, plus any the person adds (`ALLOWED_HOSTS`, for example a Tailscale name) | Stops DNS rebinding (planning notes, section 4). |
| Secrets | Generated on first run into the data folder, never shipped, never shared between copies | |
| Accounts | One person; no default password; first run asks for a name and a password or a passphrase | |
| Data folder | The operating system's per-user data folder, not the install folder | An update never touches it. |
| Backups | A copy of the data file before every update and each week, the last 7 kept, a "Back up now" button | Local data has no Neon to restore from. |
| Updates | Check is **off**; "Check for an update" is a button; checksums published with every release | "Nothing phones home." |
| Claude | **Off** until the person pastes their own key or sets a local model address (an environment setting, never a form field) | The owner's key is never in a download. |
| Circle link | Not included under the updated 2026-10-20 hosted boundary | Local-only accounts do not connect to the hosted family circle. |
| Error reporting, analytics | None | |
| Young-folk mode | Part of the local edition, decided 2026-10-18: no age question; no accounts, forum, circle link, Claude or shared pictures | Collecting nothing is the protection; no one is excluded. |

### Spend (outside the code, the owner's steps)
A monthly limit on the Anthropic workspace used only by the hosted app; Neon compute and storage caps; Upstash on a plan that stops rather than bills.

## Order of work

Sizes as in the audit: S an hour or two, M a session, L several.

| # | Step | Size | Status |
|---|---|---|---|
| 1 | Record the decision (Y1, Y9, Y4) and this plan | S | Done 2026-10-18 |
| 2 | `DS_EDITION` flag and the `Host` allowlist; `.env.example` | S | Done 2026-10-18 (`a911ac9`) |
| 3 | The forum only inside a circle (migration 074); a leader can remove posts, comments and members; a scaled report threshold | M | Done 2026-10-18 (`854ef5a`); migration 074 is on the dev branch only |
| 4 | Limits for free accounts: `MAX_ACCOUNTS`, picture bytes per account, prompt length | M | Partly done 2026-10-18 (`b5c6ab5`: `MAX_ACCOUNTS`). The prompt length limit already exists (1,000 + 200 characters) and the 500 proposed above would cut the text the picture maker builds, so it is kept; picture bytes per account for circle-computer pictures are left |
| 5 | A circle code makes an account (Challenge 4) | M | Done 2026-10-18 (`1eccb44`, migration 075 on the dev branch only): the "what goes where" tick comes first, 60 accounts a circle (`MAX_ACCOUNTS_PER_CIRCLE`) |
| 6 | Import of the Settings export (the way into the full edition, and a restore) | M | Done 2026-10-18 (`40e5086`, `c44ee87`, `67b5bf1`), at the answer to Y12 (every tool at once, adds only): `lib/import*.ts`, `app/api/import/route.ts`, the Settings "Import" card. A replacing "Restore" waits for local mode |
| 7 | The Picture Studio download: worker, guide, a test screen, checksums | M | Built 2026-10-18 (`e19e4d2`): `image-worker.ts --check`, `scripts/build-studio-package.ts`, `docs/picture-studio-download.md`; the zip, its published checksum and a trial on a second PC are the owner's |
| 8 | The local database spike (PGlite or SQLite) | M | Done 2026-10-18 (`1980247`): PGlite runs all 77 migrations and the app's own database code; `docs/spike-local-database.md`. Y13 answered yes: PGlite is a pinned dependency |
| 9 | Local mode: first run, generated secrets, server-only features hidden, backup and restore, and the **young-folk mode** (ED13) | L | Steps built 2026-10-18 (see ED9 in `docs/open-items.md`): `DS_DB_DIR`, seeding of the shared data, first-run set-up and generated secrets, backup and restore, the one-process lock, server-only features absent under `DS_EDITION=local` (the last one not yet checked in a browser). Left: young-folk mode (ED13), a friendlier page for a locked folder, packaging. Y15: no release before Felix G's yes and the ED18 answers |
| 10 | Circle link from the full edition | L | Superseded 2026-10-20: local-only accounts do not connect to the hosted family circle. |
| 11 | Packaging, signing, updates | L | Packaging built 2026-10-21: portable folder with `start-divination-station.bat` (`scripts/build-local-package.ts`) and Docker (`Dockerfile`, `docker-compose.yml`), guide `docs/local-edition-setup.md`. Signing: decided against. Updates: a new zip; no update check |
| 11b | Host mode: a leader's copy shared with a circle over Tailscale, 5 to 10 people | L | Decided 2026-10-21, planned in `docs/plan-host-mode.md`, not built |
| 12 | Repository clean-up, licence, secret scan, new privacy text | M | The owner's choices first |

Steps 4 to 7 can go in any order after 3. Nothing from 8 on should start before the owner has seen 7 working, because 7 is the part a circle leader needs.
