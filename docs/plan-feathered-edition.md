# Plan: the Feathered edition (and naming the Winged edition)

**Written 2026-10-22 by a Claude session, from the owner's request of the same day:** "a lightweight 'Feathered' edition that doesn't have any AI features or external calls at all, to be released alongside the 'Winged' (host) edition." Just before, the owner asked whether the whole app could run from a flash drive with nothing left on the computer it is used on, for discreet use beside the quick exit. This plan treats that as Feathered's second purpose. The request is the owner's; the design, sizes, order and every default below are proposals to change. Nothing here is built.

Read with `docs/plan-editions.md` (the editions as they are), `docs/plan-host-mode.md` (Winged) and `docs/release-plan.md` (what blocks a release).

## Owner decisions, 2026-10-22 (answers to section 8)
1. **Two downloads, Feathered and Winged.** No third plain local download.
2. **Feathered is for one person only**, with no circle, forum or invite pages. Moving between the two editions must be smooth: section 7.1.
3. **Sealed, passphrase-locked data, in the first release.** The first-run screen offers it on by default and lets a person turn it off; the guide says how to change it either way later (section 4.2).
4. **The quick exit turns the app into a Hekate-themed snake game**, with no way back to the app except a discreet one (section 4.5).
5. **Quick exit pauses and locks; only "Stop and remove the drive" stops the app.**
6. **The person chooses where the data lives**: on the drive (the default) or on the computer the drive is plugged into (section 4.6).

## 1. The two downloads

| | **Feathered** | **Winged** |
|---|---|---|
| Who it is for | One person, on their own computer or on a flash drive they carry | One person, or a circle leader serving 2 to 30 friends over Tailscale or Headscale |
| What it is in the code | `DS_EDITION=local` with `DS_MODE=feathered` (a new mode), built separately | `DS_EDITION=local`, with `DS_MODE=host` when the leader turns hosting on (today's full local edition) |
| AI | None. No companion, no Claude buttons, no interviewer, no picture maker. The code for them is not in the download | Everything, each off until the person turns it on (a Claude key, a companion model, a picture computer) |
| Network | Answers only to this computer (`127.0.0.1`). Makes no outgoing connection, ever | Answers to this computer, and to the tailnet name in host mode. Outgoing only for what the person turned on |
| Circles, forum, invites | No | Yes, in host mode |
| Passkeys | No (a passkey stays on the computer it was made on, which breaks a flash drive) | Yes |
| Data | Sealed by default: one passphrase-locked file, on the drive or on this computer, the person's choice (section 4) | The data folder as today, with backups beside it; it can also open a sealed file, so a Feathered copy upgrades in place (section 7.1) |
| Quick exit | Locks, and turns into the snake game (section 4.5) | The same snake game; Settings can choose the weather search instead |
| Size (to measure) | Smaller: no Anthropic SDK, no Redis client, no AI pages | As today |

**Recommendation: ship exactly these two downloads.** Winged is today's full local package renamed; a person who wants the full app alone simply leaves host mode off, so a third "plain local" download adds a choice without adding anything. The hosted family copy stays as it is and is not called either name.

The names are the owner's. "Feathered" suits the light one well; "Winged" the one that flies out to friends. In the app, the edition name shows on the About page and in the start window's first line, nowhere else.

## 2. What Feathered keeps

Everything that is the person's own practice: tarot readings, spreads, journals, the library and encyclopedia (from the reference bundle, which is already offline), the oracle deck kit with drawn and uploaded art, every divination tool, Patterns, predictions and look-backs, days, "write what you sense first" with confidence, conditions, tarot practice, blind-target practice, the yearly review, cloths, own archetypes and concepts, search, reading comfort and themes, sigils, export, import, backups and the quick exit.

Nothing on that list needs AI or the network today, so Feathered loses none of the intuition work. That is worth saying in its download text: the AI in Winged is a mirror that asks questions; Feathered is the same mirror without it.

## 3. What Feathered leaves out, found in the code

### 3.1 AI (the routes and pages, from a scan of `app/` on 2026-10-22)
| Area | Routes | Pages and components |
|---|---|---|
| Claude buttons | `/api/interpret`, `/api/synthesize`, `/api/claude/*`, `/api/ask`, `/api/guide`, `/api/insights/pattern`, `/api/encyclopedia/concepts/[id]/description`, `/api/layouts/suggest-colors` | Interpret and synthesize buttons, `GuidePanel` |
| Companion | `/api/companion/*`, `/api/worker/companion/*` | `CompanionPanel`, `CompanionFocusCard`, `CompanionFocusForm`, `CompanionNoticed`, `useCompanionJobs`, its section in Settings |
| Interviewer | `/api/interview` | `InterviewPanel` |
| Picture maker | `/api/oracle/image-jobs/*`, `/api/oracle/image-tool`, `/api/oracle/styles`, `/api/oracle/decks/[id]/style`, `/api/worker/*`, the AI part of `/api/oracle/cards/[id]/art` and `/api/oracle/gallery` | `ArtMaker` (the generate part only), `/admin/workers` ("Picture computers") |

Drawn and uploaded card art stays. `/guide` ("How this works") stays as a page; only its AI panel goes.

The list above is a starting point, not a guarantee. Step F1 turns it into a test that fails when a route imports an AI module and is not hidden, so a new AI route can never slip into Feathered unnoticed.

### 3.2 Outgoing connections the app can make today
| What | Where | In Feathered |
|---|---|---|
| Anthropic | `lib/claude-access.ts`, `lib/ai-stream.ts` | Not in the build |
| The companion model (KoboldCpp) | `lib/companion-model.ts` (`COMPANION_URL`) | Not in the build |
| The picture program | `lib/image-tool.ts` (`IMAGE_GEN_URL`) | Not in the build |
| Upstash Redis (the picture studio's doorbell) | `lib/studio-signal.ts` | Not in the build |
| random.org | `lib/rng.ts`, the "random.org" choice in Settings (`/api/rng-method`) | Removed: the choice offers only "this computer" methods |
| The quick exit's landing page | `components/nav/logout.ts`, `QUICK_EXIT_URL` = a Google weather search | Replaced by the snake game, served by the app itself (section 4.5) |
| Links to sources, crisis lines and the help page | `lib/sources.ts`, `lib/tool-origins.ts`, `app/help`, and others | Kept as links. A link is the person's own choice, not a call the app makes. Each opens with `rel="noreferrer"` so the other site is not told where the person came from (check that all do) |

Already right, and worth keeping right: fonts are bundled (`@fontsource`), the security policy allows connections to the app itself only (`connect-src 'self'` in `lib/csp.ts`), and the start scripts already bind to `127.0.0.1`.

Found on the way, for every edition: `@google/genai` is in `package.json` but nothing imports it. Remove it.

## 4. Running from a flash drive (portable and discreet)

### 4.1 Honest limits, said first
"Nothing left on the computer" can be got very close to, but not completely. What the app can promise:
- **None of the person's writing or data ever touches the computer's disk.** It lives sealed on the drive and is opened only in memory.
- **No settings, caches, cookies or history from the app are left in the computer's browser**, when the start script can open its own private browser window (4.4).

What it cannot promise, and the drive's guide must say plainly:
- Windows records that a program ran (Prefetch, and similar lists). It shows that `node.exe` ran from a drive letter, not what it did. Clearing these needs an administrator and is out of reach.
- A computer that is watched (a keylogger, monitoring software, a work or school computer with management) can see whatever is on the screen and typed. Use Feathered only on a computer the person trusts not to be watching.
- The operating system may move memory to its swap file under pressure.
- If the drive is lost, the sealed file is safe only as long as the passphrase is strong.

### 4.2 The sealed data file
Today a local copy keeps a PGlite database folder (`DS_DB_DIR`) with backups and a secrets file beside it (`lib/local-db.ts`, `lib/local-backup.ts`, `lib/local-secrets-core.ts`). On a flash drive that is a readable folder of thousands of small files, which is both slow and exposed.

**On by default, and the person's choice (owner, 2026-10-22).** The first-run screen asks one question, in plain words, with the first answer chosen:
- "Lock my writing with a passphrase. Best on a flash drive or a computer other people use. If you forget the passphrase and lose your recovery codes, nobody can get your writing back."
- "Don't lock it. Simpler. Anyone who can open the data folder can read what you wrote."

Settings has the same switch later ("Lock my data" on or off), so a person can change their mind either way: turning it on seals the folder into the file, turning it off opens the file into an ordinary folder after the passphrase is typed. The guide (F8) has a short part for each: "Not hiding anything? You can turn locking off" and "Want it locked later? Turn it on in Settings". Unlocked, Feathered works as the local edition does today: an ordinary data folder and an ordinary account password.

Locked, Feathered keeps the data in **one sealed file** instead, `my-data/feathered.sealed`:
1. At start, the app serves only an unlock page. The person types their passphrase.
2. The file is decrypted (AES-256-GCM, key from the passphrase with scrypt, via `node:crypto`, so no new package) into memory, and PGlite opens it in memory (`loadDataDir`, which `lib/local-db.ts` already uses for restore). Nothing is written to the computer's disk.
3. After each change (debounced to about 30 seconds) and at stop, the database is dumped (`dumpDataDir`, already used for backups), encrypted and written to the drive under a temporary name, then renamed over the old file. The previous seal is kept as `feathered.sealed.previous`, so a drive pulled out mid-write loses at most the last change.
4. The session secret, uploaded and drawn pictures, and backups go inside the sealed database or are encrypted the same way. Pictures are files in `ART_DIR` today (`lib/art-store.ts`): Feathered stores them encrypted under `my-data/pictures` with the same key.
5. The passphrase is the sign-in. Feathered is one person, so the `/setup` account step becomes "choose a passphrase" and the login page becomes the unlock page. Recovery codes stay (they are the only way back if the passphrase is forgotten, and the guide must say so twice).

This also helps a Feathered copy kept on an ordinary computer: a shared household computer cannot read it.

Size and speed to measure in F3: the dump of a full database with the reference bundle (expected tens of megabytes, gzip), and how long a save takes on a slow USB 2 drive. If a save is too slow to run after every change, save on a timer and at quick exit and stop.

### 4.3 What the start scripts set
- `HOSTNAME=127.0.0.1` (already), so Windows never asks to open the firewall.
- `TMP`, `TEMP` and `TMPDIR` pointed at a folder on the drive, emptied at start and at stop.
- `NEXT_TELEMETRY_DISABLED=1`, in the build and at run time.
- The Next.js cache folder stays inside `app/` on the drive (it already does in the standalone build; F3 checks nothing is written elsewhere).
- No service worker. Feathered does not register `/sw.js` (`components/ServiceWorkerRegistration.tsx`), so the browser keeps no cached pictures.

### 4.4 The browser
The biggest trace on a computer is the browser: its history shows `localhost:47831`, and its storage keeps the app's small settings (recent pages, reading comfort, navigation width and theme in `localStorage`). The start script opens the app in **a private window with a profile folder on the drive**, trying in order:
- Windows: Microsoft Edge (on every Windows computer): `msedge --inprivate --user-data-dir=<drive>\browser-profile --no-first-run`, then Chrome or Firefox the same way.
- Mac: Chrome or Firefox the same way; Safari cannot be started private from a script, so the guide says to press Shift+Cmd+N.
- Linux: Firefox or Chromium the same way.
- When none is found, the script says in plain words: "Open a private window and go to http://localhost:47831".

Feathered also keeps `localStorage` use to what is needed for the page to look right, and clears it at lock and stop.

### 4.5 Quick exit, the snake game, and stopping
**Pause and lock (owner, 2026-10-22).** The quick exit (the header button and Esc twice, built 2026-10-22) seals the data, forgets the key and locks the app. The server keeps running. Only "Stop and remove the drive" stops it.

**The snake game (owner, 2026-10-22).** Instead of leaving for a web page, the quick exit turns the tab into a small snake game, at once, with no outgoing request:
- **What it looks like: as minimalist and cutesy as possible (owner, 2026-10-22).** A plain soft board, nothing else on screen but the score. The snake is a row of round, soft-coloured dots with a little round head and two dot eyes that blink now and then. Its food is one tiny thing at a time, drawn in a few strokes: a little key or a little flame, the only nods to Hekate. Each one makes the snake one dot longer, with a tiny happy wiggle. Hitting itself or the edge ends the round with a gentle "oops", never a crash or a red screen. The colours come from the theme tokens (`app/globals.css`), drawn on a canvas with no pictures to load. Arrow keys or WASD, and swipes on a phone. With "less motion" on (reading comfort), the blink and wiggle are off.
- **What a snooper sees.** The tab title becomes "Snake" with a plain icon. Every address of the app shows the game while it is locked this way, so Back, Refresh or typing an address all show the game too. The quick exit already replaces the page in the history (`location.replace`).
- **One honest catch, kept small.** The key and flame are the only hints of Hekate, and they are tiny. Settings can still swap them for a plain apple and berry, for someone who needs no hint at all.
- **In Winged too (owner, 2026-10-22).** The game is shared code. Winged's quick exit shows it as well, locking the person's session; Winged's Settings can choose the old weather search instead.

**The way back: the high-score name (owner, 2026-10-22).** When a round ends, the game asks "Name for the high-score table", as snake games do. Typing the passphrase there unlocks the app and goes back to the page the person left. Anything else just goes on the table, so a snooper who types a name sees an ordinary game. Why this one:
- It needs the secret. A snooper who knows the trick still cannot get in, so the trick never has to be hidden from anyone.
- It looks natural, with no hidden button that someone could tap by accident or find.
- Wrong names are never errors, but they are slowed down quietly after a few tries (`lib/login-limit.ts`), so guessing is not worth it.
- With locking turned off, the account password works the same way.

Other ways back, considered and not recommended: a secret key pattern (anyone watching can copy it, and it still has to open a passphrase box that gives the game away), or tapping a hidden spot such as the moon (found by accident, and it also needs a visible passphrase box).

The game must be playable with the keyboard alone, and must say the score aloud to a screen reader when a round ends (`accessibility-pass`).

**Stop and remove the drive**, a new item in the menu: seals, empties the drive's temporary folder, stops the server and shows "You can take the drive out now." On Windows the person still uses "Safely remove", and the guide says so.

### 4.6 Where the data lives, and which computers the drive starts on
These are two separate things.

**Where the data lives: the person chooses (owner, 2026-10-22).** The first-run screen asks, with the first answer chosen:
- "Keep my data on this drive." Nothing about the person's writing is ever left on the computer. They can carry the drive to any computer.
- "Keep my data on this computer." The data goes in a folder in the person's own user folder on that computer (for example `Documents\Divination Station`), sealed if locking is on. The drive is then just the program. The guide must say plainly: this leaves a file on that computer on purpose, and the data opens only when the drive is plugged into that computer.

Settings has "Move my data" to switch later, either way. It copies, checks the copy opens, then removes the old one. A small file on the drive (`my-data/where.json`) remembers where the data is, holding only the folder's path, never the data. The data stays sealed in both places when locking is on.

**Which computers the drive starts on (a packaging choice, not a setting).** Today's packaging builds one folder per kind of computer (`scripts/build-local-package.ts`: Windows, Linux x64 and arm64, Mac Apple silicon and Intel), each with its own copy of Node. A Windows folder on a drive starts only on Windows computers.

The app itself is the same for every computer. Only Node and sharp's picture library differ, and sharp loads the right one by itself. So Feathered can also come as an **"any computer"** folder: one `app/`, a Node program for each kind of computer, every sharp package, and a start file for each (`.bat` for Windows, `.command` for a Mac, `.sh` for Linux), all sharing one `my-data`. A person who uses a Windows computer at home and a Mac at a library can then carry one drive. It costs about 400 MB more (four extra Node programs at about 100 MB each; to measure).

**Recommendation:** offer Feathered as the per-computer folders (smaller) **and** the "any computer" folder, on the same download page. It is still one edition, just different sizes. Format advice for the guide: exFAT, which Windows, Mac and Linux all read and write.

Known snags to test (F6): a Mac blocks unsigned programs from a drive more firmly than from Downloads (the `.command` already clears the quarantine mark); Linux may mount a drive without permission to run programs, so the `.sh` falls back to `sh start.sh`; FAT32 drives cannot hold the "runnable" mark at all.

## 5. Proving "no external calls"

A promise like this needs a check, not just care. Four layers, from cheapest:
1. **Not in the build.** The Feathered build (`DS_FEATHERED=1 next build`) points the AI modules (`@anthropic-ai/sdk`, `ioredis`, `lib/claude-access.ts`, `lib/companion-model.ts`, `lib/image-tool.ts`, `lib/studio-signal.ts`) at small stand-ins that refuse, using `turbopack.resolveAlias` in `next.config.ts` (read the Next 16 docs in `node_modules/next/dist/docs/` first; the alias API may differ from older versions). The packaging script leaves their packages out of `node_modules`. Then a test greps the built folder for `api.anthropic.com`, `upstash`, `random.org` and `google.com` and fails on any hit.
2. **Not reachable.** `lib/edition-features.ts` gets `FEATHERED_HIDDEN_PREFIXES` (everything in `LOCAL_HIDDEN_PREFIXES`, plus the AI routes and pages in 3.1, passkeys and `/admin/workers`), answered "not found" by `proxy.ts`, left out of the navigation, the search and Settings, the way `serverOnly` and `noHost` work today.
3. **Refused if tried.** In Feathered, `instrumentation.ts` replaces the server's `fetch` and Node's outgoing connection functions with ones that refuse any address that is not `127.0.0.1` or `::1`, and logs the refusal. The browser side is already held by `connect-src 'self'` and `form-action 'self'` in `lib/csp.ts`.
4. **Watched in a test run.** A variant of `scripts/smoke-pages.mts` starts the packaged Feathered folder inside a network namespace with no outside network (`unshare -n` on Linux, available in the cloud sessions), visits every page at both widths, and fails on any request from the browser or the server to anything but loopback. This runs before every Feathered release.

## 6. Order of work

Each step is one session or less, with its tests. F0 is the owner's; everything else waits only on it.

| Step | What | Size | Depends on |
|---|---|---|---|
| F0 | Owner answers section 8 (done 2026-10-22) | owner | none |
| F1 | `DS_MODE=feathered` in `lib/edition.ts` (a new `Shape`), `FEATHERED_HIDDEN_PREFIXES`, navigation, search and Settings hiding, random.org removed, service worker off, the test that every AI-importing route is hidden. Remove `@google/genai` | small to medium | F0 |
| F2 | The separate build: module stand-ins, `--edition feathered` in `build-local-package.ts`, the built-folder grep, `NEXT_TELEMETRY_DISABLED`, drive temporary folder | medium | F1 |
| F3 | The sealed data file in shared code (so Winged can open it too), unlock page, passphrase as sign-in, encrypted pictures and backups, the lock switch in first run and Settings, save timing measured on a slow drive | large (the one real build) | F1 |
| F3b | Where the data lives: the first-run choice, `where.json`, "Move my data" | small to medium | F3 |
| F4 | Quick exit locks; "Stop and remove the drive" | small | F3 |
| F4b | The snake game: Hekate and plain looks, every address shows it while locked, the high-score name unlocks, quiet slowing of wrong names, keyboard and screen-reader play | medium | F4 |
| F4c | The upgrade start file in each download (section 7.1), with its test: Feathered to Winged and back on a copy of real data | small to medium | F2, F3 |
| F5 | Start scripts that open a private browser window with a drive profile | small to medium | F2 |
| F6 | The one-drive-for-any-computer build, and its tests on Windows, Mac and Linux (owner's device day) | medium, plus owner time | F2, F5 |
| F7 | The network-free smoke run (section 5, layer 4) and the outgoing-connection guard | medium | F2 |
| F8 | Words: the Feathered guide (`FEATHERED.md` in the download: what it keeps, the honest limits in 4.1, a strong passphrase, recovery codes, safe removal), the privacy text for Feathered (shorter than the local one: nothing leaves the drive, no AI), the itch.io page text for both downloads, About page. `copy-check` on all of it | medium, owner's wording pass | F3 |
| F9 | Release both: Winged is today's package under its new name; Feathered from F2 to F8. `pre-commit-check push` | small | F8, and Lane 0 of `docs/release-plan.md` (ED18, ED20) |

The release plan's advice to freeze features before release applies here too. Of these, F1, F2 and F4 are cheap and low risk. F3 is the real cost, and the owner wants it in the first release.

## 7. Risks
- **A forgotten passphrase is lost data.** Recovery codes are the answer, offered at set-up and shown again in Settings. There is no back door, by design.
- **Sealing costs time on slow drives.** Measured in F3; the timer setting is the fallback.
- **Two builds to keep working.** Every later feature must say whether it is in Feathered. The hiding test (F1) and the built-folder grep (F2) catch the AI side automatically; `pre-commit-check` should name the Feathered smoke run when `lib/edition*.ts`, `proxy.ts` or a route list changes.
- **Moving between editions.** Section 7.1.
- **Expectations of discretion.** The guide must not promise more than 4.1 allows. The words are the owner's; this plan only marks where they go.

### 7.1 Upgrading Feathered to Winged, in place (the owner asked for this to be smooth)
The owner suggested a third package that upgrades the app in place. **Recommendation: no third package. Each download carries a small upgrade start file instead.** The reasons:
- Both editions keep their data the same way: the same database, the same migrations and the same folder layout (`app/`, `node/`, `my-data/`, the start files). Only `app/` differs. So an upgrade is "swap `app/`, keep `my-data/`", and a separate package would just be Winged's `app/` under a third name, to build, test and explain.
- One page, two downloads, and no "which one do I need?" moment.

How it works:
1. The person downloads Winged and runs **"Upgrade a Feathered copy"** (`upgrade.bat`, `.command` or `.sh`) from it.
2. It asks where the Feathered folder is (the drive, or a folder), checks Feathered is stopped, and makes a backup of `my-data` beside it (sealed if it was sealed).
3. It replaces `app/` and the start files with Winged's, and leaves `my-data/` and `settings.env` alone.
4. On the next start, Winged opens the sealed file with the same passphrase (sealing is shared code, step F3), runs any new migrations as an update always does, and everything is where the person left it. The AI features are there but off, as in any Winged copy, until the person turns one on.

The guide says once, plainly, before step 3: after the upgrade, this copy can reach the internet if you turn on an AI feature, and it is no longer the "nothing leaves" edition.

**Going back** (Winged to Feathered) is the same file in the Feathered download. Notes the AI made stay in the data, hidden in Feathered and back again after another upgrade, so nothing is lost either way. Circle and forum data stays in the data too but is not shown, since Feathered has no circle pages.

**Settings → About** shows the edition and, in Feathered, one line: "Want circles or the AI companion? Download Winged and run Upgrade."

## 8. Questions for the owner
All answered on 2026-10-22. The six at the top of this file, then four more: the high-score name is the way back; the snake game is in Winged too; the "any computer" folder is offered beside the per-computer ones; each download carries the upgrade start file, with no third package. Nothing is waiting on the owner before F1.
