# Screen-reader tests (NVDA)

Real NVDA, driven by Guidepup. Not part of `npm test`: it needs a Windows desktop, it speaks out loud, and it signs in to a running dev server.

1. One time: `npx @guidepup/setup install nvda` (about 100 MB, goes to `%LOCALAPPDATA%\guidepup`; your own NVDA is untouched).
2. Start the dev server (`npm run dev`) and use a test account on the **dev branch** (see the `test-as-user` skill).
3. Run, with the password read from a file outside the repo:

```bash
A11Y_USER=claude-test-name A11Y_PASS="$(cat path/to/pw.txt)" npm run test:sr
```

Do not touch the keyboard or mouse while it runs.

Use `toWebContent(page, nvda)` from `helpers.ts`, never `nvda.navigateToWebContent()` directly: Guidepup focuses the page by clicking the middle of `<body>`, which pressed whatever was there (a reading in the list opened, a font in Settings got chosen). The helper puts a see-through cover over the window for that click. A failing test prints what NVDA actually said.
The cloud has no NVDA; there, `scripts/a11y-audit.mts` and `scripts/a11y-flows.mts` check names, roles, contrast and where focus goes (`accessibility-pass` skill). They cannot hear, so these tests are still the only check of what NVDA says.
These tests check what is announced; they do not replace listening to the app yourself once.

**Messages that appear after a delay are not captured (2026-10-17).** A `role=status` or `role=alert` text that arrives a moment after a server answer was never in `spokenPhraseLog()`, and neither was a test message added to an empty live region 2 seconds after load; a message that appears at once after a key press is captured (`/recover`, the tool stars). So assert the DOM and where focus goes, print what NVDA said, and do not claim a delayed announcement was heard or missing. Also: four tests failed once when all the files ran together and passed alone; re-run a failure alone before chasing it. In the search window NVDA keeps the first Escape for itself, so a second one closes the window.
