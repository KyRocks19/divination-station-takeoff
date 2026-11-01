---
name: run-app
description: Start, stop and smoke-test the dev server on the owner's Windows PC, or when npm/node is not recognized. (A cloud session: see before-you-code section 0.)
---

# Run the app (Windows native)

Project root: `C:\Users\you\projects\divination-station`. Next.js 16 + Postgres (Neon).

## Prerequisites
1. Node 20.9+ (LTS). Check `node -v` in PowerShell. If "not recognized": install with
   `winget install OpenJS.NodeJS.LTS`, then **open a new terminal** (PATH is read at launch).
   Bash tool sessions may lack Node even when PowerShell has it, so prefer the PowerShell tool.
2. `npm install` only if `node_modules` is missing or `package.json` changed.
3. `.env.local` (live database and keys) and `.env.development.local` (the Neon dev branch) must exist; see `.env.example`
   and `docs/dev-database.md`. Never print their values.

## Commands
- Preferred in the desktop app: `preview_start` with `divination-station-dev` (`.claude/launch.json`). If port 3000 is
  the user's own server, use `divination-station-attach` and **do not stop it**. Only one `next dev` per folder.
- Dev: `npm run dev` -> http://localhost:3000 (Next picks another port if busy; read the output).
  Run with `run_in_background` so the session isn't blocked.
- Production-style: `npm run build` then `npm run start`. Both `dev` and `start` listen on 127.0.0.1 only (security audit, 2026-10-16); a phone reaches the app through `tailscale serve` (`https://your-pc.your-tailnet.ts.net:10000` proxies to `http://localhost:3000`), never the house Wi-Fi.
  **Build and start read the live database**, not the dev branch.
- Verify: `curl.exe -s -o NUL -w "%{http_code}" http://localhost:3000/login` -> expect 200.
  Other pages redirect (307) to `/login` without a session cookie. That is normal.
- Stop: find the PID with `Get-NetTCPConnection -LocalPort 3000`, then `Stop-Process -Id <pid>`. Stop only servers you started.
- Signed-in testing: use the `test-as-user` skill.

## Gotchas
- **`npm run dev` reads the Neon dev branch** (`.env.development.local` wins over `.env.local`). Scripts and
  `npm run migrate` read `.env.local` (live) only. Print the database host before running either; see `add-migration`.
- A change to `app/globals.css` `@theme` is not picked up by a running dev server; restart it.
- Auth is `proxy.ts` (Next 16's renamed middleware). Logging in needs an existing user row.
- The image tool and companion model run on the owner's PC (`IMAGE_GEN_URL`, KoboldCpp); both are optional for development.
- Stale `.next/` after odd errors: stop the server, delete `.next`, restart.
