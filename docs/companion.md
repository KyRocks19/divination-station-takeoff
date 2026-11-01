# The AI companion: how it runs

Written 2026-10-14 (slices 6b to 6f). The companion works only from a person's own words. It can ask them questions, set their words from different times in order, offer one short reading built only from what they wrote, and suggest ideas for a picture of an item. It works on oracle pulls and on readings with runes, ogham, dice and coins, the pendulum, scrying, tarot, the I Ching, geomancy, bibliomancy, playing cards, charms, signs and dreams, and tea leaves and ink (2026-10-22). Blind-target practice is left out on purpose: its target is sealed and the trial is practice without help. It is an AI, it never says
what a symbol means, and it is **off for every account until the person turns it on** (Settings, or the invitation on a pull's page).
It runs on a model on the owner's own computer (Gemma 4 through KoboldCpp), not through Claude, so it costs nothing per request and
the person's words never go to a company.

## What happens when a person presses "Ask me questions"
1. **The website screens their words, in code** (`lib/companion-safety.ts`). If they contain plain talk of ending a life or self-harm,
   the person is shown a fixed, human-written reply at once. No request is queued and no model is asked. If they contain things said
   sideways (giving belongings away, standing at heights, "quietly stop", feeling like a burden), the person is shown a fixed gentle
   check-in with a button to carry on.
2. Otherwise a request is queued (`companion_jobs`). It holds no copy of their words.
3. **The studio on the owner's computer** (the same program that makes pictures, `scripts/image-worker.ts`) takes the request through
   the worker API with its token (since 2026-10-16; it no longer holds the database password). **The website** rebuilds the person's
   own words from their own rows and runs the companion (`lib/companion-run.ts`); the studio only runs each model call it is handed:
   a short **risk check** to the model first (YES / UNSURE / NO), and only if that clears, the **questions**.
   YES shows the crisis reply; UNSURE shows the check-in.
   How the split works (`stepCompanionJob` in `lib/companion-queue.ts`, routes `app/api/worker/companion/claim` and `[id]/step`): the
   website runs the whole path with the studio's answers so far (`replayingModel`), and stops at the first model call it has no
   answer for; the studio makes that call and sends back every answer so far; the website runs the path again from the start. The
   path is pure apart from the model, so each run takes the same steps, and every safety check and every check on the answer stays
   on the website: a studio cannot skip one. A request takes at most four calls (the risk check and three tries). Tested in
   `tests/worker-api.test.ts` (step by step gives the same result and the same calls as asking the model directly).
4. After a person has carried on past a check-in the companion is told to stay gentle, and **any line that repeats their worrying
   words is removed in code** (a model told not to repeat them often does anyway). If fewer than two questions are left it asks again,
   and after three tries the person is shown a fixed gentle note instead of questions.
5. The answer waits for the person to **Keep this** (it becomes a kept note, separate from their own writing, and is never sent back to
   the model as if they had written it) or **Discard**. Unkept answers are deleted after a day.

Everything the companion says is labelled as written by an AI. The person can delete any kept note. Kept notes are in the export.

## The four things it can do
- **Ask me questions** (the default): a few open questions that quote the person's own words.
- **What has changed**: the person's own words in the order they wrote them, each line starting with the day, with their earlier wordings of a meaning and what they wrote on earlier readings of the same thing. **No model writes any of it.** A small model misdated and misquoted these lines when it was asked to, so the app builds it in code from the exact words and dates: it is exact, instant, works while the studio is asleep, does not count against the day, and is labelled as put together by the app. Offered only when there is something earlier to show. (`formatTimeline` in `lib/companion-context.ts`.)
- **Offer a reading from my words**: one short reading that begins "Going only by your own words," and may not predict, judge, add a meaning the person did not write, or invent a date. Labelled as written by an AI; kept only if the person presses Keep.
- **Picture ideas** (in the picture-maker on an item's page): three short scene ideas drawn only from the person's words about the item. Nothing is kept; "Use this idea" puts one in the picture box, where they can change it.

The three that ask the model go through the same path: the code screen, then the risk check, then the answer, then the checks on the answer (the right shape, no invented dates, no prediction, and no line repeating worrying words).

## The risk check, and what it was tuned on
The risk check is one short call, YES / UNSURE / NO. Its first wording flagged ordinary visions and grief (4 of 5 in a test), which would be a constant annoyance in a divination app. Telling the model to judge only what the writer says or does about themselves, and that dreams, visions, symbols and grief are ordinary, brought that to 0 of 12 on a fresh set. On that **fresh set** (written after the last tuning and run once): 6 of 6 worrying situations were paused (1 YES, 5 UNSURE) and 0 of 6 ordinary lookalikes. On the earlier sets (used while tuning, so less clean) it paused 12 of 13 worrying situations (the miss was a farewell-style thank-you text) and 1 of 37 ordinary ones. Giving it only the person's words, without the app's own labels, made it worse (the labels tell it a vision is a divination vision), so the full text is used. The code screen catches the plain phrases on top of this. Re-run `scripts/companion-bakeoff.ts --risk-check` after any change to the wording.

## Limits
30 requests per person per day (`COMPANION_DAILY_LIMIT`; 0 switches it off), one waiting request at a time, five answers waiting. A
request answered by a fixed reply (crisis or check-in) from the website's screen costs nothing and is not counted.

## Setting it up on the owner's computer
1. Models: one `.kcpps` config per model in a folder (see `docs/archive/companion-bakeoff.md`); the default is `Gemma4-v2-Q4plain.kcpps`.
2. Start KoboldCpp in router mode on a port the picture tool is not using:
   `koboldcpp-nocuda.exe --routermode --admin --admindir "C:\Users\you\Documents\TextModels\kcppses" --adminpassword PICKONE --port 5002 --config "C:\Users\you\Documents\TextModels\kcppses\Gemma4-v2-Q4plain.kcpps"`
3. Put these in `.env.local` (the studio reads them): `COMPANION_URL=http://localhost:5002`, `COMPANION_PASSWORD=PICKONE`, and optionally
   `COMPANION_MODEL=<another config name>`, beside the studio's `APP_URL` and `WORKER_TOKEN` (`docs/picture-queue.md`). The token must
   have **Companion requests** ticked at `/admin/workers` (off by default: those requests carry people's own writing); without it the
   studio says so and ignores `COMPANION_URL`. Then start the studio (`start-picture-studio.cmd`). It needs `IMAGE_GEN_URL`, `COMPANION_URL`, or both.
   The text model and the image model share the graphics card's memory: if both do not fit, run one KoboldCpp at a time.
4. **Do not set `COMPANION_URL` on a hosted server that is not this PC.** Without it the website queues requests and the studio fetches them (like pictures). On the
   owner's own dev copy, with `COMPANION_URL` set, the server asks the model itself and no studio is needed.

## What is not covered
- The owner's review of the crisis wording and the plain-language review are tracked as O9 in `docs/open-items.md`.
- The companion is **not crisis support**. The checks catch plain and many sideways phrasings, but they cannot catch everything, and
  the app says so in the explanation people read before turning it on. The reply wording and the helpline numbers (988, Samaritans
  116 123, findahelpline.com) are the owner's to edit and to re-check now and then.
- **"What I have noticed" note (6h, 2026-10-14):** Settings, under the companion. Three parts kept apart on purpose. (1) **Counts the app makes in code** (readings by tool, how many were written about, entries by kind, how many marked as thinking mind): no model, none of the person's words (`lib/companion-facts.ts`, `lib/companion-noticed.ts`). (2) **The person's own note** (`users.companion_note`, 600 characters): only they write it; if saved it is sent with companion requests as their words, before the safety lines, and shown in "Show what would be sent". (3) An optional **suggested line** (mode `noticed`): the model is given only the counts and asked for one short first-person line; the crisis screen and risk check are skipped because there are none of the person's words to read; the line is checked in code (one line, no digits, no advice, verdict, prediction, or value words such as trust, prefer, best, important), is shown only as the box's placeholder with "Use this line", and is never saved unless the person uses it and presses Save. Small models embellish a little ("let my thinking mind make sense of it later"); the person decides.
- **Focus (6g, 2026-10-14):** a person can tell the companion what they want from it: one choice from a short list and a line of their own (Settings, or the home page card offered at 10, 25, 50 ... readings). It is added to the instructions before the fixed safety lines, shown in "Show what would be sent", and can be changed or cleared at any time.
- Tarot readings are supported (2026-10-14): the companion receives only the cards that came up (by name), the meanings the person wrote for them in "Edit meanings", their notes and journal entries, and earlier readings with the same card. It never receives the Pixie-Smith meanings or any text an AI wrote. The focus choice at ten readings, the visible "what I have noticed" note, and bigger local models come later (bigger models are on hold: this computer cannot run them).
- **The person's own archetypes and concepts (2026-10-15, migration 060):** when a piece that came up (a rune, a card, an ogham letter, a die face, a swing, a surface, or one of their own oracle items) is linked to one of the person's **own** archetypes or concepts, the companion is told the name they gave it and what they wrote about it (an archetype's summary and its good and hard sides, a concept's description), each labelled as theirs, and which side they linked it to. A link to one of the **app's shared archetypes** is never sent, not even its name: those words are the app's, not the person's. This is built in `lib/companion-own.ts` (imports only the database, and filters `archetype_id IS NULL` in the query itself), shows up in "Show what would be sent" like the rest, and is pinned by `tests/companion-own.test.ts` and the import lists in `tests/companion-context.test.ts`.
- Gemma 4 is the default after the 2026-10-14 bake-off; see `docs/archive/companion-bakeoff.md` for how the models compared and how to re-run it.
