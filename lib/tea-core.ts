// The teas a person can choose before a tea-leaf reading (owner's request, 2026-10-25), and the way each one's leaves are drawn. This file
// touches no database code, so screens that run in the browser can import it.
//
// What is known about which tea is used (checked 2026-10-25):
// - "Tea-Cup Reading and Fortune-Telling by Tea Leaves, by a Highland Seer" (late 19th or early 20th century; Project Gutenberg 18241) says
//   China tea is best, and that Indian tea and cheap blends hold so much dust and so many bits of stem that they are often no use.
// - Tea sellers' guides today (Harney & Sons, Twinings) say loose leaf, not the cut tea from a bag; black, green or oolong all work; teas
//   with pieces of fruit or flower can hide the leaves. Herbal teas are used too, more as a matter of taste.
// The concepts beside each tea are the app's own suggestions for what to bring to mind before a reading. No tradition gives them, and the
// screens say so. Each slug is one of the shared archetypes in lib/archetypes-data.ts (tests/tea-core.test.ts checks).


export type TeaKind =
  | "china-black"
  | "black"
  | "earl-grey"
  | "green"
  | "oolong"
  | "white"
  | "rooibos"
  | "chamomile"
  | "peppermint";

/** How the leaves of a tea look once they are wet and left in a cup. */
export type LeafForm = "broken" | "needle" | "unfurled" | "flake" | "flower" | "bud";

export interface Tea {
  kind: TeaKind;
  label: string;
  /** Examples a person may have in the cupboard. */
  examples: string;
  /** One plain line on the leaves: what they look like in the cup, and how well they read. */
  leaves: string;
  /** Why someone might choose it before a reading: the app's own suggestion. */
  mindset: string;
  /** Concepts from the shared archetypes to bring to mind (the app's suggestion, not a tradition's). */
  concepts: string[];
  form: LeafForm;
  /** The colour of the brewed tea, for the brewing picture and the stain left in the cup. A picture colour, fixed on purpose. */
  liquor: string;
  /** The colour of the wet leaves. */
  leaf: string;
  /** A second colour for some leaves: the pale side of a leaf, a petal. */
  leafLight: string;
}

export const TEAS: Tea[] = [
  {
    kind: "china-black",
    label: "China black tea",
    examples: "Keemun, Lapsang Souchong, Yunnan black",
    leaves: "Thin, twisted, dark leaves that break into neat pieces. The old handbook signed \"a Highland Seer\" calls China tea the best for reading.",
    mindset: "For a reading about where something began, or what has been carried along from the past.",
    concepts: ["past-memory", "tradition-convention", "solitude-reflection"],
    form: "broken",
    liquor: "#8c3f17",
    leaf: "#2a170d",
    leafLight: "#5a3420",
  },
  {
    kind: "black",
    label: "Everyday black tea",
    examples: "Assam, Ceylon, English or Irish breakfast (loose, not from a bag)",
    leaves: "Small broken pieces and some dust. Loose breakfast tea reads well; the fine cut inside a tea bag is mostly dust.",
    mindset: "A strong, ordinary cup. For questions about energy, work and what to do next.",
    concepts: ["energy-vitality", "work-craft", "progress-momentum"],
    form: "broken",
    liquor: "#7a2f10",
    leaf: "#22130a",
    leafLight: "#4d2c18",
  },
  {
    kind: "earl-grey",
    label: "Earl Grey",
    examples: "Black tea with bergamot oil; some have cornflower petals",
    leaves: "Black tea pieces, sometimes with a few blue petals among them.",
    mindset: "For questions about how you speak and are heard, and what is clear or not yet clear.",
    concepts: ["communication-expression", "intellect-clarity", "beauty-charm"],
    form: "broken",
    liquor: "#93451a",
    leaf: "#26160c",
    leafLight: "#3d5a9a",
  },
  {
    kind: "green",
    label: "Green tea",
    examples: "Sencha, gunpowder, Dragon Well",
    leaves: "Olive-green needles and opened pellets. They settle lighter than black tea, so a pale cup helps.",
    mindset: "Fresh and light. For a new start, for healing, and for seeing a thing plainly.",
    concepts: ["new-beginnings", "healing-health", "focus-concentration"],
    form: "needle",
    liquor: "#b7b552",
    leaf: "#3e4d1c",
    leafLight: "#6f8030",
  },
  {
    kind: "oolong",
    label: "Oolong",
    examples: "Tie Guan Yin, Da Hong Pao, milk oolong",
    leaves: "Large leaves that open out in the water, with fewer pieces. Shapes are bigger and fewer.",
    mindset: "Half one thing and half another. For questions of balance, change and waiting for the right time.",
    concepts: ["balance-moderation", "change-transformation", "patience-waiting"],
    form: "unfurled",
    liquor: "#c38424",
    leaf: "#33301a",
    leafLight: "#5d5a2c",
  },
  {
    kind: "white",
    label: "White tea",
    examples: "White peony (Bai Mu Dan), silver needle",
    leaves: "Pale, soft buds and small grey-green leaves. Faint in the cup; look closely.",
    mindset: "Quiet and delicate. For listening inward and for peace.",
    concepts: ["intuition-inner-knowing", "peace-harmony", "youth-innocence"],
    form: "bud",
    liquor: "#d9bd6c",
    leaf: "#62613f",
    leafLight: "#8f8d68",
  },
  {
    kind: "rooibos",
    label: "Rooibos",
    examples: "Red bush, honeybush (herbal, no caffeine)",
    leaves: "Short red-brown needles that scatter widely.",
    mindset: "Warm and earthy. For questions about home, family and steady ground.",
    concepts: ["family-home", "nature-earth", "security-stability"],
    form: "needle",
    liquor: "#ad3f17",
    leaf: "#6a2810",
    leafLight: "#934022",
  },
  {
    kind: "chamomile",
    label: "Chamomile",
    examples: "Loose chamomile flowers (herbal)",
    leaves: "Flower heads and petals rather than leaves. Tea guides warn that flowers can hide the shapes; some people like them anyway.",
    mindset: "Calm, for the evening. For questions about rest, dreams and looking after yourself.",
    concepts: ["rest-selfcare", "dreams-vision", "peace-harmony"],
    form: "flower",
    liquor: "#dcb848",
    leaf: "#9a7418",
    leafLight: "#cdb46a",
  },
  {
    kind: "peppermint",
    label: "Peppermint",
    examples: "Loose peppermint or spearmint leaf (herbal)",
    leaves: "Flat, crumbled pieces of dark green leaf.",
    mindset: "Sharp and waking. For clearing your head and choosing between paths.",
    concepts: ["intellect-clarity", "decisions-choices", "energy-vitality"],
    form: "flake",
    liquor: "#a9a453",
    leaf: "#2d3b1c",
    leafLight: "#4e6330",
  },
];

export const TEA_KINDS = TEAS.map((t) => t.kind);

const BY_KIND = new Map(TEAS.map((t) => [t.kind, t]));

export function isTeaKind(v: unknown): v is TeaKind {
  return typeof v === "string" && BY_KIND.has(v as TeaKind);
}

export function getTea(kind: TeaKind): Tea {
  return BY_KIND.get(kind)!;
}

/** Porcelain colours for the cup in the picture: the same in every theme, like a real white cup. */
export const PORCELAIN = { saucer: "#e9e3d8", rim: "#fbf8f2", bowl: "#f6f1e8", shade: "#d9d1c3" };

/** What the app says about the teas, on the form. */
export const TEA_WORDS = {
  choose: "Choose the tea you are drinking, or would drink. The leaves in the picture are drawn to look like that tea's.",
  concepts: "Concepts to bring to mind while it brews. These are the app's suggestions, not a tradition's; use your own if they fit better.",
  source: "An old handbook signed \"a Highland Seer\" prefers China tea; tea sellers today say any loose black, green or oolong works.",
};
