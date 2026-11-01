---
name: companion-privacy-audit
description: Audit that the AI companion only receives the person's own words and nothing is sent without the preview screen. Use after changing companion code or any new kind of the person's writing, and before a release.
---

# Companion privacy audit

## The rule
Stock text is **never** sent to the AI: the tarot deck, Pixie-Smith meanings, common meanings, archetype summaries, concept descriptions, source cards. What *may* be sent is the person's **own** words (their meanings, notes, journal entries, answers) and only along the path the person controls: a code screen first, with a "Show what would be sent" view. Read `docs/companion.md` for the full design.

## Audit steps
1. **Imports pinned.** `tests/companion-context.test.ts` asserts what the context builders import (`companion-context.ts` imports only `./divinations`, `./oracle`, `./oracle-forms`; `companion-context-tools.ts`, `companion-subject.ts`, `companion-noticed.ts` have fixed lists too). Run `npm test`. If the lists must change, the new import must be the person's own data, never a stock file; update the test deliberately and say why.
2. **Grep for stock imports** in `lib/companion-*.ts`:
   ```
   grep -nE "from \"\./(cards|common-meanings-data|archetypes-data|card-associations|runes-data|ogham-data|dice-data|sources|pendulum-swings|scrying-surfaces)\"" lib/companion-*.ts
   ```
   Expect no output.
3. **Every send goes through the preview.** Find each place that calls the model (`lib/ai-client.ts`, `lib/companion-run.ts`, `lib/claude-api.ts` callers). Confirm each one shows the person the exact text first, or is blocked until they have chosen to send.
4. **New kinds of writing.** If this slice adds something a person writes (their own archetype, concept, link, note), decide where it joins the context: same path as their other writing, behind the code screen, with a limit on size, and a test that pins the imports.
5. **Safety and quota.** `companion-safety` (crisis wording) and `ai-quota` still apply to any new route. Tests: `companion-safety`, `ai-quota`.
6. **Logs.** `lib/ai-log.ts` must not store the person's text beyond what the design says.
7. **Other people's data.** Every query is scoped to the signed-in user id; forum posts and other accounts' data are never in the context.

## Report
Say which steps passed, which you ran, and anything you could not verify (for example, no live model call was made).
