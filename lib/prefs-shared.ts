import type { Hemisphere } from "./sky";
import type { DivinationKind } from "./divination-kinds";
import type { Comfort } from "./comfort";
import { DEFAULT_NAV_FOLDED, type NavFoldKey } from "./nav-groups";

export const DEFAULT_COMPANION_NAME = "Companion";
export const MAX_COMPANION_NAME = 40;

export type Scaffolding = "more" | "less";

export interface Prefs {
  /** Which half of the world the user is in; decides which seasonal festival a date falls near. */
  hemisphere: Hemisphere;
  /** How much explanatory text the app shows around cards and readings. */
  scaffolding: Scaffolding;
  /** Whether the home page suggests readings to look back on. */
  lookbackPrompts: boolean;
  /** Whether the oracle deck pages show a fixed question for when the person is unsure what to make or write. */
  oraclePrompts: boolean;
  /** Whether an item's page offers to make pictures with an image tool on the person's own computer. Never runs by itself. */
  artHelp: boolean;
  /** Whether the AI companion is switched on (it is off until the person turns it on). */
  companionEnabled: boolean;
  /** Whether the person said in Settings that they are 18 or older (migration 092). The companion, the Claude buttons and sensitive concepts need it. */
  adultConfirmed: boolean;
  /** The name the person gave their companion; "Companion" until they choose one. */
  companionName: string;
  /** The key of the focus the person chose for the companion (lib/companion-focus.ts), or null. */
  companionFocus: string | null;
  /** The person's own line about what they want from the companion. Empty when none. */
  companionFocusLine: string;
  /** Whether a day's page lists that day's readings by itself (as links; nothing is copied). On by default. */
  daysListReadings: boolean;
  /** The person's own "what I have noticed about how I like to work" note (slice 6h). Empty when none. */
  companionNote: string;
  /** The highest reading-count milestone the focus invitation has been answered or set aside for. */
  companionFocusAsked: number;
  /** Whether a reading first asks the person to write what they sense, keeping its meanings closed until they have (migration 090). On by default. */
  guessFirst: boolean;
  /** The divination tools the person chose to see first. Null means every tool. */
  tools: DivinationKind[] | null;
  /** The parts of the side navigation the person folded away (migration 094). See NAV_FOLD_KEYS in lib/nav-groups.ts. */
  navFolded: NavFoldKey[];
  /** The person's own colours (token name to hex colour), or null for the app's own. See lib/theme.ts. */
  theme: Record<string, string> | null;
  /** The person's reading-comfort choices kept in the account (migration 079), or null when they are kept only on the device. See lib/comfort.ts. */
  comfort: Comfort | null;
}

export const DEFAULT_PREFS: Prefs = {
  hemisphere: "north",
  scaffolding: "more",
  lookbackPrompts: true,
  oraclePrompts: true,
  artHelp: true,
  companionEnabled: false,
  adultConfirmed: false,
  companionName: DEFAULT_COMPANION_NAME,
  companionFocus: null,
  companionFocusLine: "",
  companionFocusAsked: 0,
  companionNote: "",
  daysListReadings: true,
  guessFirst: true,
  tools: null,
  navFolded: DEFAULT_NAV_FOLDED,
  theme: null,
  comfort: null,
};
