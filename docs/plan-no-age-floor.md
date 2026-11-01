# Plan: what "no age floor" (option A) would take, and a forum on a separate site

**Current status:** open implementation and owner work is tracked only in `docs/open-items.md` (ED12–ED14, ED17, ED20, O9–O12, and Y11). This plan preserves the design and decision history.

**Written 2026-10-18 by a Claude session, at the owner's request.** Read `docs/research-minimum-age.md` first (the law and the UN guidance, with sources and what was not checked). This is a plan, **not legal advice and not a decision**: a lawyer should review the parts marked "counsel" before anything here is built for strangers.

## What the owner decided (2026-10-18)

- **First release: hosted accounts are for people 13 and over, and younger people are told kindly that the downloadable app is for them** (it asks nothing and keeps everything on their computer). Y10 is closed on this.
- Option **A** (no age floor on the hosted copy either) is a possible later step, which this plan describes.
- The forum could be a **separate website**; the owner is fine with it being 13 and over "as long as they get the full app".

## 1. The first release: 13 and over, and the message

The law does not require the app to ask anyone's age (FTC FAQ A.12). So the app **states the rule and does not ask**: no age field, no birth year, nothing stored. If an age were asked it would have to be neutral (a list that stops at 13 is not).

Draft wording (plain, literal, no reproach; to be run through `copy-check` and read by the owner):

> **Join page, above the form:** "Hosted accounts are for people aged 13 and over. By making an account you are saying you are 13 or older. If you are younger, you are very welcome to use the downloadable app instead: it asks nothing about your age, needs no account, and keeps everything you write on your own computer." *(Until the downloadable app exists, replace the last sentence with: "A downloadable app for younger people is being made. It will ask nothing about your age and keep everything on your computer.")*
>
> **Privacy notice, new short section "Who this is for":** "This hosted copy is for people aged 13 and over, because it keeps what you write on a server that the owner can read. The downloadable app has no age rule: it keeps everything on your computer, and the owner never receives it. If we learn that an account belongs to someone under 13, we will say so kindly, offer them a copy of their writing, and then delete the account."

Notes: (1) the promise "we delete and offer a copy" is what COPPA expects once the operator *knows* (FTC H.1); (2) raising `PRIVACY_VERSION` makes everyone read the screen again, which is right here because the rules changed; (3) nothing in the app should say or imply that younger people are unwelcome: the sentence points to a door.

**Work: S (an hour or two).** Waits for the owner's OK on the wording and for a decision on whether to ship it before the downloadable app exists.

## 2. What option A would take

Option A means **under-13s on the hosted copy too**. The app already has an unusually small data footprint, which makes it more feasible than for most services:

| What a hosted account holds today | Checked how |
|---|---|
| Username, display name (optional), password hash, a sign-in cookie | `lib/auth.ts`, `migrations/` |
| Everything the person writes (readings, journals, predictions, days, oracle items, pictures) | the schema |
| **A raw IP address for failed sign-ins, kept for a day** (`login_attempts`, key `ip:<address>`); Redis counters keyed by account | `lib/login-limit.ts`, `migrations/034` |
| **No email, no phone, no real name required, no location** (the "sky" snapshot is computed from the date only), no ads, no analytics in the code read | grep of the code; **third-party scripts on the pages were not audited** |
| The owner can read the whole database; backups last up to about 60 days | `components/PrivacyNotice.tsx`, `docs/backups.md` |

The workstreams, in the order they would be done. Sizes as in the audit: S an hour or two, M a session, L several.

| # | Workstream | What it is | Size | Who |
|---|---|---|---|---|
| A1 | **Legal basis and counsel** | Decide with a lawyer which legal basis the hosted copy relies on (consent, or contract / legitimate interests, which changes whether GDPR Article 8 applies), and what each target country needs. | M | Owner + counsel |
| A2 | **Parental consent for under-13s (US) and under the national age (EU)** | The hard part. FTC-recognised ways (FAQ I.4 to I.11): "email plus" (allowed only if the child's data is used internally and never disclosed; needs a confirming second step), a card tied to a real charge, government ID, a posted form, or a platform's consent. **The app has no email at all**, so email-plus means adding a parent's email address (new personal data, hashed per J.4) and an email service. Cheapest honest route: a parent makes the account and holds it. | L | Owner + counsel, then code |
| A3 | **Parent model** | A parent account that creates and holds a child's account; consent records (who, when, how, which text); the parent can see that the account exists, delete it, and refuse more collection (K.2, M.1). **The parent does not read the child's writing**: GC25 paragraphs 75 and 76 warn against routine monitoring. | L | Code |
| A4 | **Data minimisation** | Stop keeping raw IPs (hash the address in `login_attempts`); shorten what is kept; confirm no third-party scripts; keep the owner's database access as narrow as possible. | S | Code |
| A5 | **Impact assessment and best-interests check** | A written assessment of risks to children (UK code standards 1 and 2, GC25 para 12 to 13), kept in the repository and reviewed yearly. | M | Owner + Claude |
| A6 | **Defaults for everyone** (UK code: apply the standards to all users instead of checking ages) | Already so: private by default, companion off, recent searches off, no streaks, no profiling, no ads. To review: the "Waiting for you" prompts (the code's "nudge techniques" standard), the shuffle moment, any wording that pressures. | S | Code and `copy-check` |
| A7 | **Claude features** | Anthropic's rules for products minors can use: say it is an AI, add safeguards, comply with child-privacy law and say so publicly. Without an age gate the app does not know who is a minor, so: **off unless a circle's leader turns them on and accepts those duties**, with the child-safety system prompt if Anthropic provides one. | M | Code + owner |
| A8 | **No strangers** | Under A no under-13 may be in a place where strangers write to them. The in-app forum therefore either goes (see section 3) or becomes 13+ only, which needs an age statement the app does not collect. | M | Decision |
| A9 | **Words for children** | The privacy notice, terms, tour and errors in child-friendly language (GC25 para 72), a short version for a young person and a longer one for a parent. | M | Claude + owner |
| A10 | **Safeguarding path** | A way for a child to tell someone, links to children's helplines by region, a response procedure, and what happens when something serious is reported. The companion's crisis handling (`lib/companion-safety.ts`) is reviewed against it. | M | Owner + counsel |
| A11 | **Retention and deletion** | How long an unused child account is kept, how deletion reaches backups (about 60 days), what a parent can ask for and in how many days. | S | Code + owner |
| A12 | **Review and upkeep** | Counsel signs off; a yearly review; a watch on new laws (US state laws on minors online were **not** researched here and may apply). | M, then yearly | Owner + counsel |

**Honest reading:** A2 and A3 are most of the cost, and they are the reason most small services choose a minimum age. They are also not needed for the owner's goal, which is that younger people can use the full app: that goal is already met by the downloadable app. A would add *hosted convenience* for under-13s (open it in a browser, use it on a phone, sync nothing). That is worth wanting, and it can wait until the app has users and the downloadable edition is out.

## 3. A forum on a separate website

**What it solves.** The forum is the riskiest part of the hosted app (strangers writing to each other). Moving it out leaves the app with no user-to-user feature, so section 2 (A8) disappears and the app can be children-friendly everywhere. The forum becomes its own service with its own rules (13 and over, its own moderators, its own privacy text), so the app and the forum do not carry each other's duties.

**What "ingest the exports" can mean, from least to most risky:**

| Level | What it is | Risk | Recommendation |
|---|---|---|---|
| **L0** | The app has a **Share** button that makes a **Markdown text (and optionally a picture of the spread)** for one reading, shown on screen with a Copy button. The person pastes it into the forum themselves. No network call, no file to parse. | None added. | **Start here.** |
| **L1** | The Share button makes a small **bundle file** (schema-versioned JSON) with only the chosen reading and the words the person ticks. The forum site has a small importer that checks it against the schema and shows it as a formatted post. | A file from the internet is untrusted: the forum must validate strictly, cap size, treat every text as plain text or sanitised Markdown, refuse links and images it did not make. | Later, if pasted Markdown is not enough. The app already has the shape: forum posts store a reading as a frozen snapshot (`forum_post_attachments.snapshot`, `lib/forum-snapshots.ts`). |
| **L2** | A "post to the forum" button that sends data to the other site under a linked account. | The app then sends people's words to a third party: consent, accounts on two sites, more duties. | Not recommended. |

**Do not use the Settings export for this.** `/api/export` is the person's whole account (every journal, prediction, circle membership, recent searches). Posting that to a forum would leak it. Sharing needs a **selective** export of one thing the person chose.

**The forum itself.** Use ready-made forum software on managed hosting (the choice is the owner's: for example Discourse, Flarum or similar; not researched here) rather than building one. It needs: a domain, a stated minimum of 13, a neutral age statement at sign-up (not an age field, unless required), a terms and privacy text, reporting, one or more moderators (today that is the owner), an invitation or open-registration choice, and spam control. Whether the earlier rule "you need a circle to see a forum" carries over is a question for the owner: it could be kept with invitation codes from circle leaders, or dropped for an open reading board. If the forum has UK users, check Ofcom's children's access assessment duties, which apply to user-to-user services (whether a small forum gets relief was not found).

**What it costs the app.** The in-app circle forum built on 2026-10-18 (migration 074) would no longer be the only forum. Options: keep it as each circle's private board for people 13 and over (works with the first release as decided), or remove it when option A is chosen (a code removal plus a migration to drop `forum_posts` after export). Lost with a separate site: attaching a live reading to a post, searching the forum from the app's search, asking Claude about a post, and the leader moderating from inside the app.

## 4. A suggested order

| Step | What | Size | Status |
|---|---|---|---|
| 1 | The 13-and-over message (section 1), after the owner's OK on the wording | S | Waits for the local edition (decided 2026-10-18) |
| 2 | Hash the IP address in `login_attempts` (A4, useful whatever is decided) | S | **Done 2026-10-18** (`5c290f4`) |
| 3 | A **Share** button producing Markdown for one reading (L0); works with the in-app forum and with any other | M | **Done for tarot readings 2026-10-18** (`603553c`); text sharing for the other tools was added with PAT1, and the picture of a tarot spread on 2026-10-20 |
| 4 | The local edition and its young-folk mode (`docs/plan-editions.md`, ED8, ED9, ED13): **this is the door for younger people** | L | The database spike is done (`docs/spike-local-database.md`); Y13 is answered (yes) and local mode's first step is built (`DS_DB_DIR`, ED9); first-run screens, backup and the young-folk mode (ED13) are left |
| 5 | The separate forum, if wanted: software, hosting, rules, moderators | M, mostly the owner | Not started |
| 6 | Option A (section 2), only when the owner chooses it, starting with A1 (counsel) | L | Not started |

## 5. Questions for the owner (answered 2026-10-18)

1. The 13-and-over message: **build the downloadable app first**; it ships after.
2. The separate forum: **by invitation**.
3. The in-app circle forum: **keep**.
4. Moderators: **a team the owner hires** (so: written guidelines, contracts that cover their access, safeguarding training; `docs/release-ladder.md`, rung 3).
5. Releasing without a lawyer: **`docs/release-ladder.md`**.

The original questions, for the record:

1. May the 13-and-over message ship **before** the downloadable app exists, with the "being made" wording? Or wait?
2. Separate forum: would it be open to read, or need an invitation code from a circle leader?
3. Keep the in-app circle forum alongside it (for people 13 and over), or plan to remove it?
4. Is there someone, or are you, to moderate a public forum? A forum with no moderator is a risk to the people on it.

## What was not checked

Everything in "What was not checked" in `docs/research-minimum-age.md`; the third-party scripts the pages load; the forum software options; whether Ofcom or EU law give a small, free, non-commercial forum any relief; the cost of any consent method.
