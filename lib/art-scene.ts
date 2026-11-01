// What the picture-maker sends as the scene, built only from words the person wrote on the item. No database code, so the
// browser imports it. Nothing here adds a meaning: the person picks which of their own words to include, repeated phrases
// are dropped, and the composition and style hints are shown to them before anything is sent.

import { cleanForm, type SetForm } from "./oracle-forms";

export const MAX_SCENE_LENGTH = 1000;
/** Image tools mostly read only the first 60 or so words of a prompt; the rest is ignored. */
export const SCENE_WORD_LIMIT = 60;

export interface SceneSource {
  id: string;
  /** What the person sees beside the tick box: the field's own name, "Where it comes from", or the meaning's label. */
  label: string;
  /** The person's own words. */
  text: string;
  /** Whether it starts ticked. */
  on: boolean;
}

export interface SceneCard {
  name: string;
  origin: string | null;
  fields: { id: number; name: string; value: string | null }[];
  meanings: { id: number; label: string | null; content: string }[];
}

/**
 * Every piece of the person's own writing on an item that could go into the picture: its name, where it comes from, each
 * field they made, and each meaning. The name and where it comes from start ticked; with no "where it comes from", the
 * first meaning starts ticked instead. Everything else starts unticked, so the person chooses.
 */
export function sceneSources(card: SceneCard): SceneSource[] {
  const list: SceneSource[] = [{ id: "name", label: "Name", text: card.name.trim(), on: true }];
  const origin = card.origin?.trim();
  if (origin) list.push({ id: "origin", label: "Where it comes from", text: origin, on: true });
  for (const f of card.fields) {
    const text = f.value?.trim();
    if (text) list.push({ id: `field-${f.id}`, label: f.name.trim() || "Field", text, on: false });
  }
  let firstMeaning = true;
  for (const m of card.meanings) {
    const text = m.content.trim();
    if (!text) continue;
    list.push({ id: `meaning-${m.id}`, label: m.label?.trim() || "Meaning", text, on: !origin && firstMeaning });
    firstMeaning = false;
  }
  return list;
}

/** Ids of the sources that start ticked. */
export function defaultSelection(sources: SceneSource[]): string[] {
  return sources.filter((s) => s.on).map((s) => s.id);
}

const LABEL_PREFIX = /^\s*(keywords?|description|summary|notes?)\s*:\s*/i;

/**
 * Cleans a scene made from several pieces of writing: a leading "Keywords:" or "Description:" label is dropped, and a phrase
 * that was already said (ignoring capitals and punctuation) is not said again. Sentences stay sentences; nothing is added.
 */
export function tidyScene(text: string): string {
  const seen = new Set<string>();
  const sentences: string[] = [];
  for (const sentence of text.split(/[.;!?\n]+/)) {
    const phrases: string[] = [];
    for (const raw of sentence.split(",")) {
      const phrase = raw.replace(LABEL_PREFIX, "").replace(/\s+/g, " ").trim();
      if (!phrase) continue;
      const key = phrase.toLowerCase().replace(/[^\p{L}\p{N} ]+/gu, "").replace(/\s+/g, " ").trim();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      phrases.push(phrase);
    }
    if (phrases.length) sentences.push(phrases.join(", "));
  }
  return sentences.join(". ").slice(0, MAX_SCENE_LENGTH);
}

/** The scene made from the ticked sources, in the order they appear on the item. */
export function composeScene(sources: SceneSource[], selected: readonly string[]): string {
  const chosen = new Set(selected);
  return tidyScene(sources.filter((s) => chosen.has(s.id)).map((s) => s.text).join(". "));
}

export function wordCount(text: string): number {
  return text.trim() ? text.trim().split(/\s+/).length : 0;
}

/** Plain composition words for each form, so a picture reads as a card, a stone, a stave, or a charm. Shown, and optional. */
export const COMPOSITION: Record<SetForm, string> = {
  cards: "tarot card illustration, portrait, one central subject, simple background",
  stones: "round emblem, one central subject, centered, simple background",
  staves: "tall narrow vertical composition, one subject, simple background",
  charms: "small round charm emblem, one central subject, centered, simple background",
};

export function compositionFor(form: unknown): string {
  return COMPOSITION[cleanForm(form) ?? "cards"];
}

/** Looks the person can add to the style note with one press. They only describe how a picture looks, never what it means. */
export const STYLE_PRESETS: { id: string; label: string; text: string }[] = [
  { id: "ink-wash", label: "Ink and wash", text: "ink drawing with soft watercolor wash, muted colors" },
  { id: "woodcut", label: "Woodcut print", text: "woodcut print, bold black lines, limited colors" },
  { id: "art-nouveau", label: "Art nouveau poster", text: "art nouveau poster, flowing lines, decorative, flat colors" },
  { id: "stained-glass", label: "Stained glass", text: "stained glass window, bold outlines, jewel colors" },
  { id: "papercut", label: "Folk-art paper cut", text: "folk art paper cut, layered paper, flat shapes" },
  { id: "storybook", label: "Soft storybook", text: "soft storybook illustration, pastel colors, gentle light" },
  { id: "dark-painted", label: "Dark painted", text: "dark fantasy oil painting, dramatic light" },
  { id: "flat", label: "Flat and simple", text: "minimal flat vector illustration, simple shapes, limited palette" },
];

/** Plain craft tips for pictures that look like cards. Shown in the picture-maker; nothing here is applied for the person. */
export const CARD_TIPS: string[] = [
  "Keep the scene short, 20 to 40 words. The image tool mostly reads only the first 60 or so and ignores the rest.",
  "Describe something you could see, not an idea. “A lantern held out over dark water” works better than “guidance”.",
  "One main subject in the middle, on a plain background, looks the most like a card.",
  "Pick a look from the list and use the same one on every item in a set, so the set looks like it belongs together.",
  "Image tools cannot spell and rarely draw a clean frame, so leave names and borders out of the picture.",
  "Make four or more at once and choose; the same words give a different picture every time.",
  "Pictures come out small and quick. Use “Make larger” on the one you like, rather than asking for a bigger picture.",
];
