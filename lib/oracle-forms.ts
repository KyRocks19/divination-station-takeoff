// The forms a personal set can take (to-do item 2c). No database code, so the browser can import it.
// The form changes only words and shapes: a stone has meanings, fields, an order, and pulls just as a card does.

export type SetForm = "cards" | "stones" | "staves" | "charms";

export const SET_FORMS: SetForm[] = ["cards", "stones", "staves", "charms"];

export const DEFAULT_FORM: SetForm = "cards";

export interface FormWords {
  /** "card", "stone", "stave", "charm". */
  one: string;
  many: string;
  /** Capitalised, for headings and buttons. */
  One: string;
  Many: string;
  /** "a card", "a stone". */
  a: string;
  /** What the whole set is called: deck, bag, bundle, pouch. */
  group: string;
  Group: string;
  /** What the person sees when choosing a form. */
  choice: string;
  /** A line for a newcomer on the set's page. */
  intro: string;
}

export const FORM_WORDS: Record<SetForm, FormWords> = {
  cards: {
    one: "card", many: "cards", One: "Card", Many: "Cards", a: "a card", group: "deck", Group: "Deck",
    choice: "Cards in a deck",
    intro:
      "An oracle deck is a set of cards you make yourself. A card can stand for a memory, a person, a place, a feeling, " +
      "a saying, or anything else from your life. You decide what each card means. A card needs only a name. " +
      "Everything else can be added later or left empty.",
  },
  stones: {
    one: "stone", many: "stones", One: "Stone", Many: "Stones", a: "a stone", group: "bag", Group: "Bag",
    choice: "Stones in a bag",
    intro:
      "A bag of stones is a set you make yourself, to draw from without looking. A stone can stand for a memory, a person, " +
      "a place, a feeling, a saying, or anything else from your life. You decide what each stone means. A stone needs only " +
      "a name. Everything else can be added later or left empty.",
  },
  staves: {
    one: "stave", many: "staves", One: "Stave", Many: "Staves", a: "a stave", group: "bundle", Group: "Bundle",
    choice: "Staves in a bundle",
    intro:
      "A bundle of staves is a set you make yourself: sticks, rods, or slips of wood to draw from. A stave can stand for a " +
      "memory, a person, a place, a feeling, a saying, or anything else from your life. You decide what each stave means. " +
      "A stave needs only a name. Everything else can be added later or left empty.",
  },
  charms: {
    one: "charm", many: "charms", One: "Charm", Many: "Charms", a: "a charm", group: "pouch", Group: "Pouch",
    choice: "Charms in a pouch",
    intro:
      "A pouch of charms is a set you make yourself: small objects to draw from. A charm can stand for a memory, a person, " +
      "a place, a feeling, a saying, or anything else from your life. You decide what each charm means. A charm needs only " +
      "a name. Everything else can be added later or left empty.",
  },
};

/** The form named by text, or null when it is not one. */
export function cleanForm(value: unknown): SetForm | null {
  return typeof value === "string" && (SET_FORMS as string[]).includes(value) ? (value as SetForm) : null;
}

/** The words for a form; anything unknown reads as cards. */
export function formWords(form: unknown): FormWords {
  return FORM_WORDS[cleanForm(form) ?? DEFAULT_FORM];
}

/** "3 cards", "1 stone". */
export function countOf(form: unknown, n: number): string {
  const w = formWords(form);
  return `${n} ${n === 1 ? w.one : w.many}`;
}
