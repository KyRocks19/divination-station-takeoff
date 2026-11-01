// Circles, the parts with no database code: limits, cleaning what people type, and the shapes the browser needs. The browser imports this
// file (components/CirclePanel.tsx), so it must never import lib/db.ts or anything that does.
//
// First build (the user's decisions of 2026-10-16): one owner per circle; people who already have an account join with a single-use code;
// a person is in at most one circle; only people an admin switches on can make one. Being in a circle shares none of anyone's writing.

/** Days a circle's invite code works for. */
export const CIRCLE_INVITE_DAYS = 7;
/** The most people in one circle, owner included. */
export const MAX_CIRCLE_MEMBERS = 30;
/** The most unused, unexpired codes a circle can have at once. */
export const MAX_OPEN_CIRCLE_INVITES = 10;
/**
 * The most accounts one circle's codes may ever make (migration 075): twice the circle's size, so people can leave and be replaced, but a
 * circle cannot be used to fill the app with accounts. A default, set here so it can be changed in one place.
 */
export const MAX_ACCOUNTS_PER_CIRCLE = 2 * MAX_CIRCLE_MEMBERS;

/** Whether a circle whose codes have made `made` accounts so far may make one more: twice the circle's size (`members`, 30 unless the copy says otherwise: lib/circle-limits.ts). */
export const circleMayMakeAccount = (made: number, members: number = MAX_CIRCLE_MEMBERS) => made < 2 * members;

export const CIRCLE_ACCOUNTS_FULL =
  "This circle's codes cannot make any more accounts. Your code has not been used. Ask the person who runs the circle.";
export const MAX_CIRCLE_NAME = 60;
export const MAX_CIRCLE_NOTE = 100;

/** A circle's name as typed, with spaces tidied, or null when it is empty, too long, or not text. */
export function cleanCircleName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const name = value.replace(/\s+/g, " ").trim();
  return name.length >= 1 && name.length <= MAX_CIRCLE_NAME ? name : null;
}

/** A note on an invite code (who it is for), or null when there is none. Too long is cut, not refused. */
export function cleanCircleNote(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const note = value.replace(/\s+/g, " ").trim();
  return note ? note.slice(0, MAX_CIRCLE_NOTE) : null;
}

// --- The owner's Claude key and the limits on it (migration 065) ---

/** Claude requests per member per day, and per circle per day, until the owner changes them. */
export const DEFAULT_CLAUDE_MEMBER_LIMIT = 15;
export const DEFAULT_CLAUDE_CIRCLE_LIMIT = 100;
export const MAX_CLAUDE_MEMBER_LIMIT = 1000;
export const MAX_CLAUDE_CIRCLE_LIMIT = 10000;

/**
 * A Claude key as typed: spaces around it are dropped, and it must look like an Anthropic key (sk-ant-, then letters, digits, - and _). Null when it
 * does not. The shape is only a typo check; the key is also tried against Anthropic before it is saved.
 */
export function cleanClaudeKey(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const key = value.trim();
  return /^sk-ant-[A-Za-z0-9_-]{20,300}$/.test(key) ? key : null;
}

/** A daily limit as typed: a whole number from 0 (switched off) to `max`; otherwise null. */
export function cleanClaudeLimit(value: unknown, max: number): number | null {
  const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max ? n : null;
}

/**
 * What a person is told before they join a circle, and again on the Circle page (open item C5). One place, so the join form, the page and the tests
 * say the same thing. It claims only what the app does; what the key holder can see in Anthropic's own tools is not the app's to promise.
 */
export const SHARING_NOTICE = {
  title: "Before you join: what goes where",
  points: [
    "Being in a circle shares none of your readings, journals or other writing. The others see only your name.",
    "If the person who runs the circle adds a Claude key, your Claude requests (when you press an Ask or Interpret button) go to Anthropic through their account, not the app's. Anthropic's rules for that account apply to what you send, and what its owner can see there is not something this app controls.",
    "If they add a picture computer, the words you type for a picture go to their computer, and they could read them there.",
    "The circle's daily limits apply to you when it uses their key. If the person who runs the app has switched Claude off for your account, that stays off.",
    "You can stop at any time: withdraw your agreement on the Circle page, or leave the circle. Nothing you wrote is deleted either way.",
  ],
  agree: "I have read this and I agree",
} as const;

/** Said first on a circle leader's own copy (host mode, docs/plan-host-mode.md point 6), where the leader's computer holds everyone's writing. */
export const HOST_SHARING_POINT =
  "This copy of the app runs on the computer of the person who hosts the circle. Everything you write here is stored on that computer, and they can read it.";

/** The points to show: on a host copy, the host's point comes first. */
export function sharingPoints(host: boolean): readonly string[] {
  return host ? [HOST_SHARING_POINT, ...SHARING_NOTICE.points] : SHARING_NOTICE.points;
}

/** The most picture computers (tokens) a circle can have at once. */
export const MAX_CIRCLE_COMPUTERS = 3;

/** What the Circle page may show about the circle's picture computer (open item C3). Tokens are never in here. */
export interface CirclePictures {
  has_computer: boolean;
  /** Whether a computer has checked in recently. Null when the circle has none. */
  awake: boolean | null;
  /** Only for the owner: each computer's name and when it was last used. */
  computers: { id: number; name: string; created_at: string; last_used_at: string | null }[];
}

export interface CircleMember {
  user_id: number;
  username: string;
  display_name: string | null;
  joined_at: string;
  is_owner: boolean;
  /** Only the owner is told these two, for the members of their own circle: whether the member agreed to use the circle's key, and how many Claude requests they made today. */
  agreed?: boolean;
  ai_today?: number;
}

/** What the Circle page may show about the circle's Claude key. The key itself is never in here. */
export interface CircleClaude {
  has_key: boolean;
  /** Only for the owner. */
  last4: string | null;
  set_at: string | null;
  member_limit: number;
  circle_limit: number;
  /** Requests made through the circle's key today, all members together (owner only). */
  used_today: number | null;
  /** False when this server has no master key (CIRCLE_KEY_SECRET), so a key cannot be stored. Only the owner needs to know. */
  can_store: boolean;
}

/** Where an invite code stands, from its row. `expires_at` and the stamps may be dates or text. */
export function inviteStatus(row: { used_at: string | Date | null; revoked_at: string | Date | null; expires_at: string | Date }, now = new Date()): "waiting" | "used" | "expired" | "revoked" {
  if (row.used_at) return "used";
  if (row.revoked_at) return "revoked";
  return new Date(row.expires_at) <= now ? "expired" : "waiting";
}

export interface CircleInvite {
  id: number;
  note: string | null;
  created_at: string;
  expires_at: string;
  status: "waiting" | "used" | "expired" | "revoked";
  used_by_name: string | null;
}

/** What the Circle page shows a person: their circle (or none), and whether they may make one. */
export interface CircleView {
  circle: {
    id: number;
    name: string;
    created_at: string;
    is_owner: boolean;
    /** The most people this circle can hold on this copy (30 hosted, 10 on a leader's own copy; lib/circle-limits.ts). */
    max_members: number;
    members: CircleMember[];
    claude: CircleClaude;
    pictures: CirclePictures;
    /** Whether this person has agreed to use the circle's key (and picture computer) for what they send. */
    i_agreed: boolean;
  } | null;
  /** Only for the owner. */
  invites: CircleInvite[];
  can_make: boolean;
  /** The person's own account id, so the page knows which row is theirs (for leaving). */
  my_id: number;
}

/** Why something could not be done, in plain words for the person; each maps to one HTTP status in the routes. */
export const CIRCLE_PROBLEMS = {
  not_allowed: { status: 403, error: "Making a circle is not switched on for your account. Ask the person who runs this app." },
  already_in_one: { status: 409, error: "You are already in a circle. Leave it first to make or join another." },
  not_found: { status: 404, error: "That is not there any more." },
  not_owner: { status: 403, error: "Only the circle's owner can do that." },
  owner_cannot_leave: { status: 409, error: "The owner cannot leave. Hand the circle to someone else first, or delete it." },
  full: { status: 409, error: "This circle is full. Ask the person who runs it to make room." },
  too_many_codes: { status: 409, error: `A circle can have at most ${MAX_OPEN_CIRCLE_INVITES} codes waiting at once. Revoke one first.` },
  bad_code: { status: 403, error: "That code does not work. It may have been used, revoked, or have expired." },
  not_agreed: { status: 400, error: "Read what goes where and tick the box to agree, then join." },
  key_bad: { status: 400, error: "That does not look like an Anthropic key. It starts with sk-ant- and has no spaces." },
  key_refused: { status: 400, error: "Anthropic did not accept that key. Check that it is copied whole and has not been deleted or switched off." },
  key_unavailable: { status: 503, error: "This copy of the app cannot store a key yet: the person who runs the app has to set CIRCLE_KEY_SECRET first." },
  too_many_computers: { status: 409, error: `A circle can have at most ${MAX_CIRCLE_COMPUTERS} picture computers at once. Remove one first.` },
  bad_name: { status: 400, error: "Give the computer a name of 1 to 60 characters, such as whose it is." },
  bad_limit: { status: 400, error: "A limit is a whole number of requests a day, from 0 (switched off) up to the largest the box allows." },
} as const;

export type CircleProblem = keyof typeof CIRCLE_PROBLEMS;
