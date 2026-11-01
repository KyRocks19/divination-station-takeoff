# Plan: host mode (open item H2)

**Written 2026-10-21 by a Claude session, from the owner's decisions of the same day.** The decisions are the owner's; the design, sizes and order are proposals for the owner to change. Read with `docs/plan-editions.md` ("Decided 2026-10-21") and `docs/setup-guide.md` Part 3.

## What the owner decided
- Circles are guided to make a Tailscale account and share their app with their friends. **5 to 10 people** per circle.
- **H1: host mode sits beside the hosted family circle.** The hosted site and its single configured circle (`DS_FAMILY_CIRCLE_ID`) stay exactly as they are. A new circle is run by its leader's own copy.
- No code signing; downloads come from itch.io (the portable folder or Docker, `docs/local-edition-setup.md`).

## What it is
A switch on the full local edition. Today a local copy is one person on one computer: no circles, forum, invites or other accounts, and it answers only to `localhost`. In **host mode** the same copy also answers to the leader's private Tailscale address and lets the leader's friends make accounts with a circle code. Nothing about the hosted site changes, and nothing is exposed to the public internet.

## Facts from the code that shape the design
| Fact | Where | Consequence |
|---|---|---|
| The pages for circles, forum, join, invites, feedback and user admin answer "not found" on a local copy | `lib/edition-features.ts` (`LOCAL_HIDDEN_PREFIXES`) | Host mode lifts the ones a circle needs; the rest stay hidden |
| A local copy refuses any `Host` name except loopback unless it is listed in `ALLOWED_HOSTS` | `lib/host-guard.ts`, `proxy.ts` | The tailnet name must be listed; this is the DNS-rebinding guard and must not be loosened |
| The write check accepts an `Origin` that matches `Host` or `X-Forwarded-Host` | `lib/origin.ts` | A reverse proxy that forwards the host name, such as Tailscale Serve, works without a change |
| First-run set-up makes the one admin account only from a loopback name, so a friend cannot get there first | `lib/local-setup.ts`, `app/api/setup/route.ts` | Already right for host mode: the leader sets up on their own computer, then turns host mode on |
| The family-circle gate is off for a local copy that has a data folder | `lib/family-access-core.ts` | Host mode needs no gate change |
| A circle holds at most 30 people; a circle code makes an account and joins in one step; a person may make a circle only if an admin allows it (the admin always may) | `lib/circles-core.ts`, `lib/circles.ts` | Host mode caps a circle at 10; the leader is the admin, so they can make the circle |
| The data folder opens in one process at a time (PGlite) | `lib/local-lock.ts`, `docs/spike-local-database.md` | Fine for 10 light users; heavy use will queue |
| The sign-in cookie is `secure` when `NODE_ENV=production`, and `SameSite=Lax` | `lib/session-options.ts` | Works over Tailscale Serve (HTTPS) and over `http://localhost` |

## Design

**1. One setting, `DS_MODE=host`, valid only with `DS_EDITION=local`.** Read in one file (`lib/edition.ts`, next to `editionOf`) so every feature asks the same question. Anything else is a plain single-person copy. The portable folder gets `start-divination-station-host.bat`; Docker gets a compose profile.

**2. The app keeps listening on 127.0.0.1 only.** The leader runs Tailscale Serve, which gives the app a private HTTPS address (`https://<computer>.<tailnet>.ts.net`) and forwards to `http://127.0.0.1:47831`. The app is never bound to a network address, so a mistake in Tailscale's settings does not put it on the local network. **Funnel (public) is never used**, and the setup page says so.

**3. What host mode turns on.** Circle, join, invite, forum and forum-report pages and their APIs. `feedback` stays hidden (it writes to the app's maker, who is not there). The circle size cap becomes 10 and the account cap `2 x 10`. Everything a person writes still goes through the same owner-scoped queries.

**4. The names the copy answers to.** `ALLOWED_HOSTS` today is read once at start. The setup page (point 5) must be able to add the Tailscale name without a restart, so the host guard also reads `my-data/allowed-hosts.json`, cached for a few seconds. Only an admin, from a loopback name, can change that file's contents through the page. The check stays a whitelist of whole names; a name ending in `.ts.net` is not accepted by pattern.

**5. A guided setup page for the leader (`/host`, admin only, reachable only by a loopback name).** Steps, each with a plain explanation and a check where one is possible:
1. What this does, and what it means for your friends' privacy (below).
2. Install Tailscale and sign in (link to tailscale.com; no check).
3. Run one command, shown to copy: `tailscale serve --bg 47831`. The app cannot and should not run it.
4. Paste the address Tailscale printed. The page checks its shape (`https://name.tailnet.ts.net`), stores it, and shows the leader a test link.
5. Share the computer with each friend (Tailscale admin console, Machines, Share). A short written guide for the friend.
6. Make the circle and a circle code (existing screens).
7. Keep the computer awake while friends use it (a link to the Windows power setting), and where the backups are.

**6. Privacy: the promise changes, and the app must say so.** A single-person copy promises that nothing leaves the computer. In host mode the leader's computer stores the friends' writing, so **the leader can read it** (the same fact `docs/beta-tester-notice.md` states for the hosted site). Needed: a host-mode privacy text; the existing "what goes where" tick at join (migration 075) reworded for a leader's copy; and the leader's own acknowledgement on the setup page before host mode starts. Changing the privacy text asks everyone to read it again, so the owner approves the wording first (`copy-check`).

**7. Pictures and Claude.** A host copy talks to the image program on the leader's computer directly (`IMAGE_GEN_URL`), so no worker token and no queue are needed; per-person daily limits already apply. Friends' pictures are files on the leader's disk (`ART_DIR`). Claude uses the leader's key or a circle owner's key (`CIRCLE_KEY_SECRET` is made on first start); off until a key is set.

**8. The leader's computer now serves others.** Say so in the guide: keep Windows and the app updated (the 2026-10-16 audit found advisories on the Next.js then in use); the app is reachable only to people the leader shared with; and the weekly backup plus "Back up now" cover friends' data too.

## Unknowns that must be tested before building (slice H2.0)
These cannot be settled from the code or the docs, and the design depends on them:
1. **Does a friend in a different tailnet reach a Serve address on a shared computer?** Device sharing is documented to share a machine, but whether the friend can open the machine's HTTPS Serve name (and with which name) is not confirmed here. Test with two real Tailscale accounts.
2. **Which ports can a shared friend reach?** If all, the leader's other programs on that computer (a database, a file server) are open to the friend. If an access rule can limit a shared friend to one port, the guide must give it exactly.
3. **The free-plan limits on sharing** (how many people a computer can be shared with, and how many Tailscale users and devices are allowed) on the day the guide is written.
4. **The cookie.** The browser keeps one cookie jar per host name; confirm `tarot_session` does not collide with another app on the same Tailscale name.
5. **Speed.** Ten people, one PGlite session, the image program busy: measure page times.

If (1) fails, the fallback is that friends join the leader's tailnet as users (the leader's free plan allows few users), or the design moves to the Funnel-free queue already built for pictures. Decide after the test.

## Order of work
Sizes: S an hour or two, M a session, L several.

| # | Slice | Size | Check |
|---|---|---|---|
| H2.0 | The Tailscale test above, with two accounts (owner step). **Checklist written:** `docs/host-mode-tailscale-test.md` | S | The five unknowns answered in this file |
| H2.1 | `DS_MODE=host` in `lib/edition.ts`; lift the hidden prefixes; circle cap 10; tests that a single-person copy is unchanged. **Built 2026-10-21** (also checked in the Linux package: `/forum` and `/circle` present, `/feedback` absent) | M | `tests/edition-features.test.ts`, `tests/host-mode.test.ts` |
| H2.2 | The names file for the host guard (`allowed-hosts.json`), admin and loopback only | M | tests for the whitelist, no pattern match, no write from a non-loopback name |
| H2.3 | The `/host` setup page and its API | M | `design-system-check`, `accessibility-pass`, `copy-check`; click-test with `test-as-user` |
| H2.4 | Privacy text and the join tick for a leader's copy | M | the owner approves the words; `companion-privacy-audit` |
| H2.5 | Launchers: `start-divination-station-host.bat`, a compose profile, and the friend's guide | S | run on this machine, then on a second computer |
| H2.6 | Real use: two computers, three people, the picture program busy; measure | M | NVDA and a real phone |

H2.1 to H2.4 do not depend on H2.0 except for the cap and the wording of step 5, but H2.0 first avoids building on a wrong assumption.

## What this plan does not do
- It does not touch the hosted site, `DS_FAMILY_CIRCLE_ID`, or any hosted data.
- It does not add a way for a single-person copy to join the hosted family circle (that stays superseded).
- It does not use Funnel, open a public port, or change what the app listens on.
