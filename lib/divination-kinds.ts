// The kinds of divination the app has, with their names and pages. This file touches no database code, so
// screens that run in the browser can import it. lib/divinations.ts re-exports everything here.

/** Which tool made a reading. A kind is added here when its tool is built. */
export type DivinationKind = "bibliomancy" | "blots" | "charms" | "dice" | "geomancy" | "iching" | "ogham" | "oracle" | "pendulum" | "playingcards" | "remoteview" | "runes" | "scrying" | "signs" | "tarot" | "tea";

/** What each kind is called on screen. A new tool adds its label here with its kind. */
export const DIVINATION_KIND_LABELS: Record<DivinationKind, string> = {
  tarot: "Tarot",
  oracle: "Oracle Deck",
  scrying: "Scrying",
  pendulum: "Pendulum",
  runes: "Runes",
  ogham: "Ogham",
  dice: "Dice and coins",
  iching: "I Ching",
  geomancy: "Geomancy",
  bibliomancy: "Bibliomancy",
  playingcards: "Playing cards",
  charms: "Charm casting",
  signs: "Signs and dreams",
  remoteview: "Blind-target practice",
  tea: "Tasseomancy",
  blots: "Inkblots",
};

/** Every kind, in the order the tool list shows them. */
export const DIVINATION_KINDS = Object.keys(DIVINATION_KIND_LABELS) as DivinationKind[];

/** The page that opens each tool. */
export const DIVINATION_KIND_PAGES: Record<DivinationKind, string> = {
  tarot: "/tarot",
  oracle: "/oracle",
  scrying: "/scrying",
  pendulum: "/pendulum",
  runes: "/runes",
  ogham: "/ogham",
  dice: "/dice",
  iching: "/iching",
  geomancy: "/geomancy",
  bibliomancy: "/bibliomancy",
  playingcards: "/playingcards",
  charms: "/charms",
  signs: "/signs",
  remoteview: "/remoteview",
  tea: "/tea",
  blots: "/blots",
};

/** Where to begin a new reading with each tool, and what to call that. A new tool adds its entry here. */
export const DIVINATION_KIND_START: Record<DivinationKind, { href: string; label: string }> = {
  tarot: { href: "/readings/new", label: "Tarot reading" },
  oracle: { href: "/oracle/pulls/new", label: "Pull an oracle card" },
  scrying: { href: "/scrying/new", label: "Scrying session" },
  pendulum: { href: "/pendulum/new", label: "Ask the pendulum" },
  runes: { href: "/runes/new", label: "Draw runes" },
  ogham: { href: "/ogham/new", label: "Draw ogham staves" },
  dice: { href: "/dice/new", label: "Throw dice or a coin" },
  iching: { href: "/iching/new", label: "Cast the I Ching" },
  geomancy: { href: "/geomancy/new", label: "Cast a geomancy chart" },
  bibliomancy: { href: "/bibliomancy/new", label: "Pull from your writings" },
  playingcards: { href: "/playingcards/new", label: "Draw playing cards" },
  charms: { href: "/charms/new", label: "Cast charms" },
  signs: { href: "/signs/new", label: "Note a sign or dream" },
  remoteview: { href: "/remoteview/new", label: "Start a blind-target trial" },
  tea: { href: "/tea/new", label: "Brew and read tea leaves" },
  blots: { href: "/blots/new", label: "Make an ink blot" },
};

/**
 * The page that is the person's own library for each tool: where they see and write what the tool's things mean to them
 * (the oracle deck's decks and cards, the 24 runes, the ogham staves, the faces of the dice, the pendulum's swings), or the
 * tool's own page where it has no set of things. Tarot's library is the Library page.
 */
export const DIVINATION_KIND_LIBRARY: Record<DivinationKind, string> = {
  tarot: "/library",
  oracle: "/oracle",
  runes: "/runes/set",
  ogham: "/ogham/set",
  dice: "/dice/set",
  pendulum: "/pendulum/swings",
  scrying: "/scrying",
  iching: "/iching/set",
  geomancy: "/geomancy/set",
  bibliomancy: "/bibliomancy",
  playingcards: "/playingcards/set",
  charms: "/charms",
  signs: "/signs",
  remoteview: "/remoteview",
  tea: "/tea",
  blots: "/blots",
};

/** The tool (other than tarot, which has its own links) whose pages a path belongs to, or null. */
export function toolOfPath(pathname: string): DivinationKind | null {
  for (const kind of DIVINATION_KINDS) {
    if (kind === "tarot") continue;
    const page = DIVINATION_KIND_PAGES[kind];
    if (pathname === page || pathname.startsWith(page + "/")) return kind;
  }
  return null;
}

/** The small picture on each tool's tile on the home page. */
export const DIVINATION_KIND_ICONS: Record<DivinationKind, string> = {
  tarot: "🃏",
  oracle: "🎴",
  scrying: "🪞",
  pendulum: "🧭",
  runes: "🪨",
  ogham: "🌿",
  dice: "🎲",
  iching: "☯",
  geomancy: "🏜️",
  bibliomancy: "📖",
  playingcards: "♠",
  charms: "🧿",
  signs: "🌙",
  remoteview: "👁",
  tea: "🍵",
  blots: "🖋️",
};

/**
 * The page that shows one reading. `id` is the id of its shared record (`divinations.id`); a tarot reading
 * is opened by the id of its row in `readings` instead.
 */
export function divinationPath(kind: DivinationKind, id: number, readingId?: number | null): string {
  if (kind === "tarot") return readingId ? `/readings/${readingId}` : "/readings";
  if (kind === "oracle") return `/oracle/pulls/${id}`;
  if (kind === "scrying") return `/scrying/${id}`;
  if (kind === "pendulum") return `/pendulum/${id}`;
  if (kind === "runes") return `/runes/${id}`;
  if (kind === "ogham") return `/ogham/${id}`;
  if (kind === "dice") return `/dice/${id}`;
  if (kind === "iching") return `/iching/${id}`;
  if (kind === "geomancy") return `/geomancy/${id}`;
  if (kind === "bibliomancy") return `/bibliomancy/${id}`;
  if (kind === "playingcards") return `/playingcards/${id}`;
  if (kind === "charms") return `/charms/${id}`;
  if (kind === "signs") return `/signs/${id}`;
  if (kind === "remoteview") return `/remoteview/${id}`;
  if (kind === "tea") return `/tea/${id}`;
  if (kind === "blots") return `/blots/${id}`;
  // A kind with no page of its own for one reading yet, or a kind the app no longer has.
  return DIVINATION_KIND_PAGES[kind] ?? "/readings";
}

/** The names of some tools in one line, for example "Tarot, Oracle deck". */
export function toolNames(tools: DivinationKind[]): string {
  return tools.map((k) => DIVINATION_KIND_LABELS[k]).join(", ");
}

/** The query parameter that widens one page to every tool ("?all=1"). It does not change the saved choice. */
export const SHOW_ALL_PARAM = "all";

/** True when a page's address asks for every tool. */
export function isWidened(searchParams: Record<string, string | string[] | undefined>): boolean {
  return searchParams[SHOW_ALL_PARAM] === "1";
}

/**
 * The address of `path`, either widened to every tool or back on the saved choice. `keep` holds the page's
 * other query parameters (a tag filter, for example), so pressing the link does not drop them.
 */
export function toolFilterHref(
  path: string,
  widened: boolean,
  keep: Record<string, string | undefined> = {}
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(keep)) if (value) params.set(key, value);
  if (widened) params.set(SHOW_ALL_PARAM, "1");
  const qs = params.toString();
  return qs ? `${path}?${qs}` : path;
}

/**
 * The words on the "Show everything" link: nothing extra when no number is known or none are left out,
 * "(5 more)" when the page counts the things themselves, and "(1 more tool)" or "(3 more readings)" when it names them.
 */
export function showEverythingCount(hidden: number | undefined, noun?: { one: string; many: string }): string {
  if (hidden === undefined || hidden <= 0) return "";
  return ` (${hidden} more${noun ? ` ${hidden === 1 ? noun.one : noun.many}` : ""})`;
}

/** How many of the tools are left out of a saved choice. Zero when the choice is every tool. */
export function toolsLeftOut(tools: DivinationKind[] | null): number {
  return tools === null ? 0 : DIVINATION_KINDS.filter((k) => !tools.includes(k)).length;
}

/** Turns saved text into a list of known kinds. Null means every tool. */
export function parseChosenTools(saved: string | null | undefined): DivinationKind[] | null {
  if (!saved) return null;
  const chosen = DIVINATION_KINDS.filter((k) => saved.split(",").includes(k));
  return chosen.length === 0 || chosen.length === DIVINATION_KINDS.length ? null : chosen;
}
