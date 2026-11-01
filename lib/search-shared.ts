// The shapes and limits of the header's search, shared by the server and the search window. Nothing is imported here on
// purpose: the window runs in the browser, and the rules in lib/search-core.ts import the whole tarot deck and the other
// shared things, which the browser does not need.

/** Fewer letters than this find nothing: one letter matches almost everything. */
export const MIN_QUERY = 2;
/** Longer queries are cut to this many characters. */
export const MAX_QUERY = 100;
/** Results shown in each group. A group with more says so. */
export const PER_GROUP = 5;

export type SearchGroupId =
  | "pages"
  | "cards"
  | "runes"
  | "staves"
  | "hexagrams"
  | "figures"
  | "archetypes"
  | "concepts"
  | "oracle"
  | "meanings"
  | "readings"
  | "journals"
  | "predictions"
  | "guesses"
  | "yours"
  | "cloths"
  | "days"
  | "earlier"
  | "forum"
  | "comments";

/**
 * Places the search looks only when the person ticks them in the window. Both are off until then, and the choice is
 * remembered on the device (not the account). They are kept apart because they are not what a person usually means:
 * "earlier" is wording they have since replaced, "comments" is other people's writing.
 */
export type SearchOption = "earlier" | "comments";

export const SEARCH_OPTIONS: { id: SearchOption; label: string; hint: string }[] = [
  { id: "earlier", label: "Earlier versions of your meanings", hint: "Wording you wrote and later changed." },
  { id: "comments", label: "Forum comments from your circle", hint: "Comments on posts you can read. Other people wrote them." },
];

/** The options in a request body: only known ones, each once, in the order above. Anything else is ignored. */
export function cleanOptions(raw: unknown): SearchOption[] {
  if (!Array.isArray(raw)) return [];
  return SEARCH_OPTIONS.map((o) => o.id).filter((id) => raw.includes(id));
}

/** The groups in the order the window shows them. The order never changes, so a person learns where to look. */
export const GROUP_ORDER: SearchGroupId[] = [
  "pages",
  "cards",
  "runes",
  "staves",
  "hexagrams",
  "figures",
  "archetypes",
  "concepts",
  "oracle",
  "meanings",
  "readings",
  "journals",
  "predictions",
  "guesses",
  "yours",
  "cloths",
  "days",
  "earlier",
  "forum",
  "comments",
];

export const GROUP_LABELS: Record<SearchGroupId, string> = {
  pages: "Pages",
  cards: "Tarot cards",
  runes: "Runes",
  staves: "Ogham staves",
  hexagrams: "I Ching hexagrams",
  figures: "Geomantic figures",
  archetypes: "Archetypes",
  concepts: "Concepts",
  oracle: "Your oracle cards and pieces",
  meanings: "Your meanings",
  readings: "Your readings",
  journals: "Your journals",
  predictions: "Your predictions",
  guesses: "What you sensed first",
  yours: "Your archetypes and concepts",
  cloths: "Your cloths and zones",
  days: "Your days",
  earlier: "Earlier versions of your meanings",
  forum: "Forum posts",
  comments: "Forum comments in your circle",
};

export interface SearchItem {
  /** Unique within the whole answer, so the window can use it as an element id. */
  id: string;
  label: string;
  href: string;
  /** One short line beside the label: the suit, the realm, the tool, the deck. */
  note?: string;
  /** The words around the match, when the match is not in the label: before, the match, after. */
  snippet?: [string, string, string];
  /** When the thing was written (an ISO time), shown in the person's own time zone by the window. */
  when?: string;
  /** A calendar day (YYYY-MM-DD), shown as a date with no time zone. */
  day?: string;
}

export interface SearchGroup {
  id: SearchGroupId;
  label: string;
  items: SearchItem[];
  /** True when more matched than are shown. */
  more: boolean;
}

export interface SearchAnswer {
  query: string;
  groups: SearchGroup[];
}

/** The query as typed, trimmed, with runs of spaces made one, and cut to MAX_QUERY characters. */
export function cleanQuery(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY);
}

/** The number of results shown, for the line that is read out. */
export function countItems(groups: SearchGroup[]): number {
  return groups.reduce((n, g) => n + g.items.length, 0);
}
