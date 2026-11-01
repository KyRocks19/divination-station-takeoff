// Example cloths: a few cloths other people have described, offered behind a button so the person can start from one. Nothing here is ever added to a
// person's cloths unless they press "Make my own copy"; the copy is theirs to change, and the app gives no zone a meaning of its own (docs/plan-thrown-item-layouts.md,
// decided 2026-10-18). Every example says where it comes from and how settled it is (write-ritual-source). Traditions that ask their keepers' permission
// before outsiders use their practice (for example the bone-throwing of Southern African diviners) are left out on purpose. This file imports only the
// cloth core, so the browser and the tests use it.

import type { Zone } from "./cloth-core";

export interface ExampleSource {
  /** One citation line. */
  cite: string;
  /** The page or text the line describes. */
  url: string;
  /** When it was read for the app, and how: a page read is not a book read. */
  checked: string;
}

export interface ExampleCloth {
  id: string;
  name: string;
  /** What the cloth is, in plain words. */
  summary: string;
  source: ExampleSource;
  /** How settled it is, in plain words. "Old" is not "better": this says only where the layout comes from and how well it is documented. */
  settled: string;
  /** Anything the copy had to decide that the source does not say. */
  assumed: string | null;
  zones: Zone[];
}

const rect = (name: string, note: string, x: number, y: number): Zone => ({ name, note, color: null, geom: { shape: "rectangle", x, y, w: 500, h: 500 } });
/** A quarter of the cloth cut on the diagonals: a wedge from the middle, wide enough to reach the corners. */
const quarter = (name: string, note: string, start: number): Zone => ({ name, note, color: null, geom: { shape: "wedge", cx: 500, cy: 500, r: 708, start, sweep: 90 } });

const LAU: ExampleSource = {
  cite: "Nicole Lau, “Rune Divination: Advanced Techniques”, Mystic Ryst journal (an online shop’s blog)",
  url: "https://mysticryst.com/blogs/the-mystic-journal/rune-divination-advanced-techniques",
  checked: "The page was read on 2026-10-20. It shows no date.",
};
const LAU_SETTLED =
  "One author’s own layout. The page names no older source or tradition for it, so it is not known to be a tradition, and other casters lay their cloths out differently.";

export const EXAMPLE_CLOTHS: ExampleCloth[] = [
  {
    id: "white-cloth",
    name: "Plain white cloth",
    summary: "A cloth with no zones: marked strips are scattered at random over it, and each one is read for itself. It is the oldest written account of casting on a cloth.",
    source: {
      cite: "Tacitus, Germania 10 (about 98 CE), English translation on Sacred Texts",
      url: "https://sacred-texts.com/cla/tac/g01010.htm",
      checked: "The same passage in the Church and Brodribb translation on the Fordham Sourcebook was read on 2026-10-20; the Sacred Texts page linked here was not opened again.",
    },
    settled:
      "Documented, as far as it goes: a Roman outsider wrote that strips from a fruit-bearing tree were marked and scattered over a white cloth. He says nothing about areas of the cloth having meanings, and he does not say what the marks were.",
    assumed: null,
    zones: [],
  },
  {
    id: "four-corners",
    name: "Four corners",
    summary: "The cloth in four equal corners, each with a context a rune takes on when it lands there.",
    source: LAU,
    settled: LAU_SETTLED,
    assumed: null,
    zones: [
      rect("Past (upper left)", "The source’s words for this corner: past, what is behind you.", 0, 0),
      rect("Future (upper right)", "The source’s words for this corner: future, what is ahead.", 500, 0),
      rect("Hidden (lower left)", "The source’s words for this corner: unconscious, hidden, internal.", 0, 500),
      rect("Visible (lower right)", "The source’s words for this corner: conscious, visible, external.", 500, 500),
    ],
  },
  {
    id: "four-directions",
    name: "Four directions and elements",
    summary: "The cloth cut into four by its diagonals, one part for each of east, south, west and north, each with an element.",
    source: LAU,
    settled: LAU_SETTLED,
    assumed: "The page does not say which side of the cloth is which. This copy puts north at the top, east on the right, south at the bottom, west on the left.",
    zones: [
      quarter("North: earth", "The source links this to material matters, the physical, and grounding.", 315),
      quarter("East: air", "The source links this to thoughts, communication, and intellect.", 45),
      quarter("South: fire", "The source links this to action, passion, and transformation.", 135),
      quarter("West: water", "The source links this to emotions, intuition, and relationships.", 225),
    ],
  },
];

/**
 * An example as the cloth the person would own: the same shape `cleanCloth` takes. The description says it began as an example, where it comes from and how
 * settled it is, so the words of the source are never mistaken for the person's own.
 */
export function exampleToCloth(ex: ExampleCloth): { name: string; description: string; zones: Zone[] } {
  const parts = [
    ex.summary,
    `Started from an example, not your own words. From: ${ex.source.cite}. ${ex.settled}`,
    ex.assumed,
  ].filter(Boolean);
  return { name: ex.name, description: parts.join(" "), zones: ex.zones };
}
