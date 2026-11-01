---
name: copy-check
description: Check user-facing words (labels, errors, empty states, tour, companion voice, source notes) against the tone and honesty rules. Use after writing or changing any such text.
---

# Copy check

The rules for wording are spread over `oracle-feature-design` (design rules and "Tarot and AI guidance"), `write-ritual-source`, the user's stated tone, and the accessibility pass. This skill gathers them in one pass over the text that changed.

## What to read
Added or changed strings in `components/`, `app/` and `lib/` (labels, hints, errors, empty states, `lib/tour-steps.ts`, `lib/privacy.ts` and `components/PrivacyNotice.tsx`, `lib/nudges*.ts`, `lib/companion-prompt.ts` and the companion's modes, `lib/sources.ts`, `lib/*-data.ts` notes), and the docs people read (`docs/beta-tester-notice.md`). Start from the diff:

```bash
git diff -U0 -- '*.tsx' '*.ts' '*.md' | grep '^+' | grep -niE "\b(wrong|incorrect|correct|mistake|missed|failed|should|must|streak|behind|overdue|incomplete|haven't|proven?|prove[sd]|scientific|guarantee|always|never|obviously|simply|just)\b"
```
That is a net, not a verdict. Read each hit in context, and also read the changed strings it did not catch.

## The rules, each with its source
1. **No right or wrong.** Nothing scores, grades, or says a reading was missed, wrong, incomplete or behind (oracle rules 4 and 10; intuition principle 3). A card half made is saved.
2. **Reflect, do not judge.** Compare the person's words with their own earlier words ("you wrote X in March and Y today"). Never "better", "worse", "improved", "wrong" (oracle rule 5).
3. **The person is the author.** No text that supplies a meaning they did not write. Stock or traditional text is labelled, optional, and comes after their own words (oracle rule 1; the "Pixie-Smith Meanings" button).
4. **Plain, literal wording.** Say what a thing does. No metaphor in instructions, labels or summaries (oracle rule 6). Short sentences; no "simply" or "just".
5. **Warm, never dismissive, never over-claiming.** Welcome faint impressions and belief. Do not state psi, a tool's accuracy, or a tradition's age as proven. Say plainly what is known and what is contested. Statistics must be correct (chance baseline, binomial). A claim about a tradition needs a source (`write-ritual-source`).
6. **No pressure.** No streaks, urgency, guilt or "you haven't". Every nudge can be dismissed. "Due" for a prediction is a fact, not a push.
7. **Errors say three things:** what happened, what is safe, what to do ("Could not save. Your text is still here; try again."). Never blame the person; never leave them unsure whether something was saved.
8. **Say exactly where words go.** What is stored, what is sent, to whom, and what is not (for example "only the shape is sent, never the readings"). It must match the privacy notice. A change in what is shared bumps `PRIVACY_VERSION` (`data-lifecycle-check`).
9. **Readable by everyone.** Aim for plain language a teenager could follow; links and buttons say what they do ("Edit", not "Click here"); never colour or emoji alone; the visible label is in the accessible name (`accessibility-pass`).
10. **Do not assume the person.** No assumed gender, family, religion or ability; "they" for a person whose pronouns are unknown. Do not pathologise.
11. **The safety wording is not yours to edit.** The companion's crisis wording and screens (`lib/companion-safety.ts`) change only with the user's say. Draft wording is waiting for their review.

## Report
A table: place (`path:line`), the text, the rule it touches, a suggested rewrite. Fix your own just-written text directly. For older text, or text the user wrote, **list it and ask**. When the user chooses a wording on a contested point, add one dated line to `DECISIONS.md`. Run `npm test` (the tour, privacy and data tests read some of these strings).

## Related
`write-ritual-source` (traditional meanings), `oracle-feature-design` (the design rules and the tarot and AI principles), `accessibility-pass` (reading and screen-reader behaviour), `companion-privacy-audit` (what the AI is shown).
