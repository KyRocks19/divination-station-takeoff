// The wording changes decided on 2026-10-18 for the shared tarot concepts (open item ED21; the audit is docs/legal-risk-concepts.md).
// Pure data, no database: the script `scripts/apply-concept-wording.ts` and the local edition's first run both apply it, and the
// test pins it. A concept is found by its `name` (the permanent seed key, which never changes), not by its id, because the ids
// on the dev branch, the live site and a local copy are not promised to match.

export interface ConceptWording {
  /** The seed key: the concept's `name` column. */
  name: string;
  /** The wording people see from now on. The concept's old display name is kept as an alias that search and import still find. */
  shownAs?: string;
  /** 'reveal': shown only to a person who turned on "Show sensitive meanings". 'hidden': shown to nobody. */
  sensitivity?: "reveal" | "hidden";
}

const FLAG = "\u{1F3F3}️‍\u{1F308}"; // the rainbow flag that begins one seeded name
const ZWSP = "​"; // a zero-width space ends one seeded name ("Abuse")

/** Sexual violence, abuse and sexual content: kept as written, behind a choice the person makes. */
const REVEAL = [
  "rape", "sexual abuse", "childhood abuse", "stolen innocence", "sex trafficking", "sex exploitation", "sex work",
  "assault", "abuse", "abuse" + ZWSP, "murder", "sex", "sexy", "seduction", "one night stand", "promiscuity",
  "becoming sexually active", "uncontrolled outbursts and sexual tension", "sexual connections",
  // Tier 2 (2026-10-19): the loss of a pregnancy, an eating disorder and a mental breakdown ...
  "miscarriage", "abortion", "stillbirth", "termination", "eating disorders", "mental breakdown",
  // ... and the words closest to a verdict on a person or to self-harm. The other despair words stay visible, under the note.
  "self-hatred", "self-loathing", "being beyond help", "near death experiences", "worst is yet to come", "severe depression",
];

/** Labels that described a kind of person, reworded as the state it names. */
const RENAMED: [string, string][] = [
  [FLAG + "homosexuality", "Sexual identity"],
  ["deviance", "Nonconformity"],
  ["affair with married man", "A secret affair"],
  ["bad mother", "Difficulty caring for others"],
  ["gold-digger", "Using a relationship for money"],
  ["womaniser", "Pursuing many partners"],
  ["sociopath", "Disregard for others"],
  ["pathological liar", "Compulsive lying"],
  ["learning difficulties", "Finding learning hard"],
  ["bitchiness", "Spitefulness"],
  ["catty", "Spiteful talk"],
  ["wicked", "Cruelty"],
  // Tier 2 (2026-10-19): labels of a kind of person among the money and crime words.
  ["conman", "Deceitful charm"],
  ["con artist", "Swindling"],
  ["gambler", "Taking risks with money"],
];

/** Plain insults: shown to nobody. The card links stay in the database, so this can be undone. */
const HIDDEN = ["slob", "loser", "deadbeat", "dim-witted", "stupidity"];

export const CONCEPT_WORDING: ConceptWording[] = [
  ...REVEAL.map((name): ConceptWording => ({ name, sensitivity: "reveal" })),
  ...RENAMED.map(([name, shownAs]): ConceptWording => ({ name, shownAs })),
  ...HIDDEN.map((name): ConceptWording => ({ name, sensitivity: "hidden" })),
];
