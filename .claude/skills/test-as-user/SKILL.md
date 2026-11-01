---
name: test-as-user
description: Make this session's test account on the Neon dev branch, sign in, and click-test the app at desktop, tablet and phone widths. Use whenever a change needs checking in a real browser.
---

# Test as a signed-in user

Each Claude session makes its **own** uniquely named test account on the **dev branch** and keeps it afterwards (never delete test accounts or their data). Never put a password in the repo, a note, a commit, or chat.

## 1. Point at the dev branch and check the host
`npm run dev` already reads `.env.development.local`. Scripts and `npm run migrate` read `.env.local` (live) only, so for any script:

```bash
export DATABASE_URL="$(grep -E '^DATABASE_URL=' .env.development.local | cut -d= -f2- | tr -d '\r"')"
echo "$DATABASE_URL" | sed -E 's#.*@([^/:?]+).*#\1#'   # print ONLY the host
```
Dev host starts `ep-your-dev-branch`. Live starts `ep-your-live-db`. If it is live, stop. (Do not use `set -a; . <(...)`: it failed in Git Bash.)

## 2. Make the account
Also export a throwaway `SESSION_SECRET` (any random string), or the import of `lib/auth.ts` fails. Write a short `tsx` script **in the project root** (so imports resolve), run it, then delete it:
- username `claude-MMDD-` plus a few random letters, display name saying it is a Claude test account;
- `createUser(username, displayName, password)` from `lib/auth.ts`;
- generate a random password and write it **only** to a file in the scratchpad.
Record the username (not the password) in PROGRESS.md's working notes.

## 3. Sign in without typing the password
```bash
curl -c jar.txt -H 'Content-Type: application/json' \
  -d "{\"username\":\"$U\",\"password\":\"$(cat scratchpad/pw.txt)\"}" http://localhost:3000/api/auth/login
curl -b jar.txt -X POST http://localhost:3000/api/privacy/ack
curl -b jar.txt -X POST http://localhost:3000/api/tour/seen
```
The last two stop the home page redirecting to `/welcome`.

## 4. Run the server
Follow `run-app` (it owns starting, attaching to the user's own server, and stopping only what you started). Remember: only one `next dev` per folder, and a change to `app/globals.css` `@theme` is not picked up by a running dev server; build and `next start -p 3100` instead.

## 5. Click-test with Playwright
Playwright is already installed (once, by the owner's request on 2026-10-18) in `C:\Users\you\projects\test-tools` (outside the repo, not in git, never in the project's `package.json`). **Do not `npm i` it again.** Put your test script in the scratchpad and import it by absolute path: `import { chromium } from "file:///C:/Users/you/projects/test-tools/node_modules/playwright-core/index.mjs"`. Launch with `chromium.launch({ channel: "chrome", headless: true })`. (Launching the Chrome program by `executablePath` closed at once on 2026-10-17; the `channel` form worked.) Pass the jar's cookies as `{ name, value, url: "http://localhost:3000" }`. Cookies and the first-run screens: step 3.
- Setting up data is quicker through the API with the jar's cookie in a `Cookie` header and an `Origin` header (the app refuses cross-site writes) than through the screen; then check the screen.
- Write the test so it can run twice: give names a random suffix, or clear what it made first. The dev branch keeps what a test makes.
- After a click that saves, **poll** the API (up to about 6 seconds) instead of sleeping a fixed time; the database can take a moment.
- Playwright's text match also finds the text inside a `<textarea>` (React copies its value there). Wait on the element that shows the saved text, such as a `p`, not on bare text.
- Widths: 1280, 1100 (desktop), 768 (tablet), 390 (phone).
- Sideways scroll: `document.documentElement.scrollWidth <= window.innerWidth`.
- After a client-side navigation use `page.waitForURL`, not `networkidle`.
- Match a list item, not bare text (the same words can appear in a footer).
- A hidden pane freezes animations; step them with `getAnimations()[0].pause()` instead of calling it a bug.
- Prefer reading the page as text to screenshots.

### Accessibility and overflow in the same run
axe-core is in the same `test-tools` folder (`C:/Users/you/projects/test-tools/node_modules/axe-core/axe.min.js`). For each page at 1280, 768 and 390 px, with the new controls opened (a list in reorder mode, a form in edit mode, a details section expanded):
```js
// no sideways scroll
const [scrollW, innerW] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]); // scrollW <= innerW
// axe: the rules the project cares about
await page.addScriptTag({ content: readFileSync("node_modules/axe-core/axe.min.js", "utf8") });
const res = await page.evaluate(() => axe.run(document, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] } }));
// res.violations: print id, node count and the first target
```
Wait out a fade-in or a transition (about 0.7 s) before running axe on an overlay, or contrast is measured mid-fade. A violation that was already on the page before your change is still worth one line in `docs/open-items.md`. This does not replace `accessibility-pass` (keyboard, focus, screen readers).

## 6. Report honestly
Say what you checked, what you did not (touch and screen readers have never been checked), and any click-tests still owed.
