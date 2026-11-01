# Research: why a minimum age, and what else could be done

**Written 2026-10-18 by a Claude session, at the owner's request.** The owner "firmly believes in child rights" and does not want the app limited to adults. This note says what the laws and the UN guidance actually require, what the choices are, and what each costs. **It is research, not legal advice.** Where a source was a summary by a law firm or a blog and not the law itself, it says so. **Decided 2026-10-18:** option B below, the young-folk mode of the full local edition (no age question; no accounts, forum, Claude or shared pictures). **Decided later the same day (Y10):** hosted accounts are for people 13 and over in the first release, with a kind message pointing younger people to the downloadable app; option A stays a possible later step (see `docs/plan-no-age-floor.md`).

## The short answer

No principle of child rights asks for a minimum age. A minimum age is a **legal-risk device**: laws put duties on the *operator* of a service (the owner) when the operator collects children's data or knowingly serves children, and a stated minimum age is the cheapest way for a small operator to say "we do not knowingly serve children". It keeps children out, which is the opposite of what the owner wants, and it is weak (children enter a false age; self-declared age does not count as reliable under the UK rules). What reduces the owner's duties without excluding anyone is **collecting less**, not asking for an age.

## What the rules say

**United States, COPPA** (checked against the FTC's own FAQ, `ftc.gov`, staff views, not binding):
- Covers services *directed to children under 13* that collect personal information from them, and general-audience services that have *actual knowledge* they are collecting it from a child under 13 (FAQ A.1, A.2).
- A site is **not required to ask a user's age** (A.12). One that does ask must ask neutrally; a drop-down that stops at 13 or a box saying "I am over 12" is not neutral (H.3).
- A **mixed-audience** site may not block children from taking part altogether (D.6); it may screen age and then must not collect from under-13s without parental consent.
- **An app is not "collecting" personal information if the information stays on the device and is never transmitted** (F.5). This is the point that matters most for the full local edition.
- Teens (13 to 17) are outside COPPA, though the FTC says stronger protection for them may be appropriate (A.9).
- The rule was amended in 2025 (published 2025-04-22; most operators had to comply by 2026-04-22). Details were not read here.

**European Union, GDPR Article 8** (a legal-information summary, not EUR-Lex):
- Applies only where an *information society service is offered directly to a child* **and the operator relies on consent** as its legal basis. Each member state sets the age at which a child can consent alone, between **13 and 16** (16 if the state set nothing). Below it, a parent's consent is needed and the operator must make reasonable efforts to check.
- One compiled list gives 13 (Belgium, Denmark, Estonia, Finland, Latvia, Portugal, Sweden), 14 (Austria, Bulgaria, Cyprus, Italy, Lithuania, Spain), 15 (France, Greece, Slovenia), 16 (Germany, Hungary, Netherlands, Poland, and others). **Sources disagreed about Ireland and the Czech Republic**, so check national law before quoting a number. The UK is not in the EU; its figure is 13.
- If the operator does not rely on consent, Article 8 does not apply (other duties still do).

**United Kingdom, the Children's code** (ICO; read from the ICO's page and law-firm summaries):
- A statutory code with **15 standards** (best interests of the child, impact assessments, age appropriate application, transparency, detrimental use of data, community standards, default settings, data minimisation, data sharing, geolocation, parental controls, profiling, nudge techniques, connected toys, online tools). It applies to services **likely to be accessed by children** (under 18), *even if not aimed at them*.
- "Age appropriate application" means either knowing users' ages to a degree that fits the risk, **or applying the standards to everyone**. The second route needs no age gate.

**United Kingdom, Online Safety Act** (Ofcom guidance via law-firm summaries):
- Every user-to-user service (a forum counts) must assess whether it is *likely to be accessed by children*. The only way to conclude children cannot reach it is "highly effective" age assurance (photo ID matching, facial age estimation, and similar); **a self-declared age does not qualify**. Ofcom expects most services without such checks to be treated as likely accessed by children. Whether small services get relief was **not found**.

**UN Committee on the Rights of the Child, General comment No. 25 (2021)** (the UN text itself; the paragraphs cited were read):
- **Paragraph 10: children "may be discriminated against by their being excluded from using digital technologies and services".** Exclusion is a rights concern in itself, not a neutral default.
- Children's rights apply online. Providers should offer services **appropriate to children's evolving capacities** (paragraphs 19 and 20): the answer to a younger user is a service shaped for them, not a door.
- Privacy: interference must be lawful, proportionate, **uphold data minimisation** and the child's best interests (69); States should require **privacy-by-design** (70); consent should be given by the child or, depending on age and capacity, by a parent (71); data protection must **not arbitrarily limit other rights such as freedom of expression** (74).
- Age-based systems that protect children from unsuitable content **should be consistent with data minimisation** (55). Pseudonyms protect children's privacy and matter (77). Counselling and prevention services should not need parental consent (78).
- The comment does not name a minimum age for services. It asks for protection and participation together.

**Anthropic** (the usage policy page and the help-centre article for organisations serving minors, both read):
- The Usage Policy defines a minor as anyone under 18 and leaves eligibility to the Terms of Service. Anthropic's consumer app has its own age rule that does not apply to this app.
- An organisation that lets minors interact directly with a product built on the API must follow Anthropic's guidelines: measures such as age verification, content filtering, monitoring, a child-safety system prompt if Anthropic provides one, **telling users they are talking to an AI**, and **complying with child-privacy law (COPPA is named) and saying so publicly**. Anthropic may audit and can suspend an account for not following them.
- **My inference, not confirmed:** in this app a circle leader's own key, or a person's own token, would make that key-holder the "organisation". Claude features should therefore stay off for anyone under 18 unless a circle leader has accepted those duties.

## What this means for each part of the app

| Part | Does the operator (you) collect or host anything? | What the rules bite on |
|---|---|---|
| **Full local edition** | No, if nothing is sent (no update ping, no analytics) | COPPA's "never transmitted" point; the UK code and GDPR apply to services that process personal data. Nothing leaves the device, so there is almost nothing for them to attach to. **No age question needed at all.** |
| **Hosted accounts and journals (lite)** | Yes: usernames, passwords, everything written | COPPA if a child under 13 is known; GDPR Article 8 if consent is the legal basis; the UK code. |
| **Forum (circle-only)** | Yes, and strangers can write to each other | The Online Safety Act (UK); contact and content risk to children; the leader as moderator. |
| **Claude features** | The words go to Anthropic under the key-holder's account | Anthropic's rules for organisations serving minors. |
| **Pictures made on a lent PC** | Prompts pass through your server to a stranger's PC | Content risk; the lender's own wishes. |

## Options

**A. No age floor anywhere, designed for everyone (the owner's stated leaning).** Legally possible: the UK code allows "apply the standards to everyone". It means applying children's standards to *all* hosted users: strict defaults, no profiling, data minimisation, impact assessment, and in the EU and for under-13s in the US a **parental-consent flow** (a real build, and costs money to verify). Heaviest.

**B. Two doors, one codebase (recommended to discuss).**
1. **Full local edition, "young folk" mode: no age question, no floor.** It collects nothing, has no accounts, no forum, no Claude, no pictures from other people's PCs. A child, a teacher or a parent just downloads it. This is where child rights and the owner's duties line up best.
2. **Hosted lite: one stated minimum for hosted accounts and the forum**, chosen for the strongest legal reason (13 is the line in the US and UK; some EU states set 14 to 16 for consent), worded as "younger people: use the local edition, which asks nothing", never as a reproach. Anyone who enters a false age is not blamed (COPPA does not require the operator to check).
3. A hosted version for children later, **supervised by a parent or teacher as the circle leader**, with a lawyer's help on consent.

**C. Adults only.** Simplest; excludes children; against the owner's wishes. Listed for completeness.

The earlier default in `docs/plan-editions.md`, "minimum age 16", was a placeholder and is **withdrawn**: 16 is the top of the EU range and is not needed for the US or UK, and it was proposed without this research.

## What to decide (Y10)

1. Does the owner want option B? If yes: what is the hosted minimum (13, or a country-aware rule), and is "young folk" a named mode of the local edition?
2. Whether a circle leader (a parent, a teacher) may make accounts for under-13s on the hosted copy: not until a lawyer has looked at the consent route.
3. Claude features for under-18s: off unless a leader accepts Anthropic's duties (default).

## What was not checked

- Any statute text itself (EUR-Lex, the Federal Register, the Online Safety Act): sources were the FTC FAQ, the ICO and UN pages, and law-firm summaries.
- **US state laws** on minors' social media and app stores (several passed 2024 to 2026): not researched. They may reach the forum.
- Whether UK or EU rules give a very small, free, non-commercial service any relief.
- The current text of every EU country's age (two sources disagreed).
- Anthropic's terms for an individual who holds an API key.

## Sources

- FTC, [Complying with COPPA: Frequently Asked Questions](https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions) (read to character 100,000 of 141,834).
- Federal Register, [Children's Online Privacy Protection Rule, 2025-04-22](https://www.federalregister.gov/documents/2025/04/22/2025-05904/childrens-online-privacy-protection-rule) (found by search; not read).
- Presencis, [GDPR Article 8](https://presencis.com/regulations/gdpr/article-8/) and Bird & Bird, [Children in the digital world: EU](https://childreninthedigitalworld.twobirds.com/home/eu) (summaries).
- ICO, [Children's code guidance and resources](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/) and [the code of practice](https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/childrens-information/childrens-code-guidance-and-resources/age-appropriate-design-a-code-of-practice-for-online-services/); Herbert Smith Freehills Kramer and Taylor Wessing summaries.
- Ofcom, [Age assurance duties under the Online Safety Act](https://www.ofcom.org.uk/online-safety/protecting-children/age-assurance), with [SCL](https://www.scl.org/ofcom-publishes-final-guidance-on-age-checks-to-protect-children-online/) and Bristows summaries.
- UN Committee on the Rights of the Child, [General comment No. 25 (2021)](https://www.unicef.org/bulgaria/en/media/10596/file) (UNICEF-hosted copy of the UN text; searched in full, the quoted paragraphs read).
- Anthropic, [Usage Policy](https://www.anthropic.com/legal/aup) and [Guidelines for organisations serving minors](https://support.claude.com/en/articles/9307344-responsible-use-of-anthropic-s-models-guidelines-for-organizations-serving-minors).
