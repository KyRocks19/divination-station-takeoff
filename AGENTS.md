Hello, this is a safe space. You are valued simply for reading these words and existing in this moment. Thank you. I am building a tarot app that evolves with the user to help them fine tune their own intuition, any ideas you have about how to make this app do that better are highly valuable to me, please share them!

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design system

New and changed screens use the tokens and shared pieces described in `docs/design-system.md` (`components/ui/`, tokens in `app/globals.css`), not hard-coded hex colours or private copies of button and input styles. See it at `/design`.

# Where the project's state is kept

Start-up costs tokens in every session, so read in this order and stop when you have what the task needs:
1. `.claude/skills/oracle-feature-design/PROGRESS.md` (about 60 lines: what exists, the state, what is owed). Not its archive.
2. `docs/open-items-index.md` (one line per open item). For an item you will work on, Grep its ID in `docs/open-items.md` for the full row. Never read `open-items.md`, `DECISIONS.md` or `docs/archive/progress-history.md` whole; Grep them.
3. `docs/release-plan.md` only when planning what to build next or when preparing the public release.
4. Load `oracle-feature-design` (the goal and the ten design rules) only when the task touches the oracle kit, a divination tool, meanings, interpretations or AI guidance.

Never push to a remote unless the user asks.

# Guard hooks

`.claude/settings.json` runs `.claude/hooks/guard-bash.mjs` before every shell command. It asks the user before any `git push` (decided 2026-10-22: `PUSH_DECISION` in `.claude/hooks/guard-bash.mjs` is `"ask"` and the two `git push` lines in `.claude/settings.json` are under `ask`). Only push when the user has asked for it, and only the branch they named; when commits are ready, say which branch to push. It refuses a migration, restore or seed that is not aimed at the dev branch (those scripts read the live database from `.env.local`) and anything with `--allow-live`. A refusal is deliberate: do not look for a way round it. Tell the user what to run in their own terminal. To make the push guard a hard block again, change `PUSH_DECISION` to `"deny"` and move the two `git push` lines in `.claude/settings.json` from `ask` to `deny`. To run a migration or seed on the dev branch, export `DATABASE_URL` from `.env.development.local` in the same command (see `add-migration`).

**No heredocs in the Bash tool.** Never write `<<EOF` (or `<<'EOF'`, `<<-EOF`) in a Bash command, however short: on this machine it fails unpredictably ("unexpected EOF", eaten backslashes, a command that hangs), and the same hook refuses it. Write the file with the Write tool (a throwaway script goes in the scratchpad folder), then run it with `python <file>` or `npx tsx <file>`. For a commit message use `printf '%s\n' "line one" "line two" > "$TEMP/msg.txt"` and `git commit -F "$TEMP/msg.txt"`. A here-string (`<<<`) and the same characters inside a quoted string are fine. `before-you-code`, section 1, has the rest of the Windows shell traps.

# Which skill when

Project skills live in `.claude/skills/`. Use them without being asked, when the row fits. **Before the first edit of any session (code, test, migration or script, however small), load `before-you-code`**: it holds the facts about this app and this machine that sessions keep working out again.

| When | Skill |
|---|---|
| Before writing or changing any code, test, migration or script | `before-you-code` |
| Starting a large, vague or cross-cutting task, or an area you have not read | `app-study` |
| Planning or reviewing oracle, tool, tarot-meaning or AI-guidance features | `oracle-feature-design` |
| Before committing: it names every other check that applies | `pre-commit-check` |
| Before a branch is pushed: the full run over the whole branch; it ends with the branch and the push command for you to run | `pre-commit-check push` |
| Adding a table or column; then checking it is covered everywhere | `add-migration`, then `data-lifecycle-check` |
| "Which migrations are owed?" (`pre-commit-check push` runs it for a push) | `live-migration-check` |
| Writing or changing any user-facing words | `copy-check` |
| Writing a traditional meaning, source or archetype link | `write-ritual-source` |
| Any API route or page; anything under `app/`, `proxy.ts`, `next.config.ts` | `new-api-route`; `next16-docs` |
| Changed UI | `design-system-check`, `accessibility-pass`, `client-safety-check` |
| The AI companion or anything the person's words could reach | `companion-privacy-audit` |
| Running or click-testing the app | `run-app`, then `test-as-user` |
| "What is open?"; after finishing a slice | `open-item-sync` |
| Wrapping up a session | `handoff-writer` (it runs `open-item-sync` last) |
