// What the picture studio (scripts/image-worker.ts) and the website's worker API (app/api/worker/**) say to each other. No database code, so the
// studio can import it without holding the database password. The studio signs in with a token of its own (lib/worker-tokens.ts) and can only:
// say hello and that it is awake, take the next picture or companion request, and send back a picture, a failure, or the model's answer.

/** Every worker token starts with this, so a pasted token is easy to recognise (and to find if it ever leaks into a file). */
export const TOKEN_PREFIX = "dsw_";
/** dsw_ and 43 characters of base64url: 32 random bytes. */
export const TOKEN_PATTERN = /^dsw_[A-Za-z0-9_-]{43}$/;

/** The largest picture kept in the database, in bytes (the worker saves it as WebP, far below this). */
export const MAX_RESULT_BYTES = 1_500_000;

/** The token from an "Authorization: Bearer dsw_..." header, or null when there is none or it is not shaped like a token. */
export function bearerToken(header: string | null | undefined): string | null {
  const m = header?.match(/^Bearer\s+(\S+)\s*$/i);
  return m && TOKEN_PATTERN.test(m[1]) ? m[1] : null;
}

/** The words a person sees when a picture could not be made, chosen by the website from the worker's status number (the worker never writes them). */
export function wordsForPerson(status: number): string {
  return status === 504
    ? "That picture took too long to make. Try again, or try fewer pictures at once."
    : status === 499
      ? "That picture was stopped."
      : "The picture studio could not make that picture. Try again in a little while.";
}

/** A status number the worker reports for a failed picture: a whole number from 400 to 599, otherwise 502. */
export function cleanFailStatus(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isInteger(n) && n >= 400 && n <= 599 ? n : 502;
}

/** How often the studio looks at the queue when nothing is waiting, in seconds, as it reports it (30 to 86400; otherwise 600). */
export function cleanPollSeconds(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 30 && n <= 86_400 ? Math.round(n) : 600;
}

// --- The companion: the website runs the checks, the studio only runs the model ---
// The companion asks the model up to four times for one request (a risk check, then up to three tries at an answer), and the safety checks sit
// between those calls (lib/companion-run.ts). So the website keeps the whole path and hands the studio one model call at a time: "ask the model
// this". The studio sends back every answer so far; the website runs the path again from the start with those answers and either asks for the
// next call or saves the result. The studio cannot skip a check, because it never sees the path, only the messages.

/** The most model calls one companion request can need: the risk check and MAX_TRIES answers (lib/companion-run.ts). */
export const MAX_COMPANION_CALLS = 4;
/** The longest model answer accepted back from the studio, in characters (the companion's answers are a few hundred). */
export const MAX_ANSWER_CHARS = 20_000;

export interface ModelCall {
  messages: { role: "system" | "user"; content: string }[];
  maxTokens: number;
  temperature: number;
}

/** What the website answers after a claim or a step: the next model call to make, or that the request is finished. */
export type CompanionStep = { ask: ModelCall } | { result: "done" | "cancelled" | "failed" };

/** The answers the studio sends back: a list of at most MAX_COMPANION_CALLS strings, each at most MAX_ANSWER_CHARS. Null when it is not that. */
export function cleanAnswers(value: unknown): string[] | null {
  if (!Array.isArray(value) || value.length > MAX_COMPANION_CALLS) return null;
  if (!value.every((a) => typeof a === "string" && a.length <= MAX_ANSWER_CHARS)) return null;
  return value as string[];
}

/** A picture job as the studio receives it: the words to draw and the shape. `user_id` is only for the studio's log. */
export interface PictureJob {
  id: number;
  user_id: number;
  prompt: string;
  form: string;
}

/** A companion request as the studio receives it. It holds none of the person's words; those come one model call at a time. */
export interface CompanionJob {
  id: number;
  user_id: number;
  mode: string;
}

/**
 * The website's address for the studio, from APP_URL. https is required, except for this computer itself (localhost, 127.0.0.1, ::1), so the
 * token never travels in the clear. Returns the address without a trailing slash, or an error in plain words.
 */
export function cleanAppUrl(raw: string | undefined): { ok: true; url: string } | { ok: false; error: string } {
  const text = raw?.trim().replace(/\/+$/, "") ?? "";
  if (!text) return { ok: false, error: "No APP_URL: set it to the website's address, for example https://divination.example.org" };
  let u: URL;
  try {
    u = new URL(text);
  } catch {
    return { ok: false, error: `APP_URL is not a web address: ${text}` };
  }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(u.hostname);
  if (u.protocol !== "https:" && !(u.protocol === "http:" && local)) {
    return { ok: false, error: "APP_URL must start with https:// (plain http:// is only allowed for this computer, such as http://localhost:3000)" };
  }
  if (u.username || u.password || u.search || u.hash) return { ok: false, error: "APP_URL should be only the address, with no name, password, ? or #" };
  return { ok: true, url: text };
}
