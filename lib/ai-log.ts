// What to say when Claude cannot answer: a line for the server's log with the real reason (never the key), and a plain
// sentence for the person. Anthropic's SDK errors carry an HTTP status and a body such as
// { type: "error", error: { type: "authentication_error", message: "invalid x-api-key" } }. Pure functions, so they can be tested.

interface Facts {
  status: number | null;
  type: string | null;
  message: string;
  requestId: string | null;
}

function factsOf(err: unknown): Facts {
  const e = (err ?? {}) as Record<string, any>;
  const status = typeof e.status === "number" ? e.status : null;
  const body = e.error && typeof e.error === "object" ? (e.error as Record<string, any>) : null;
  const inner = body && typeof body.error === "object" && body.error ? (body.error as Record<string, any>) : body;
  const type = typeof inner?.type === "string" ? inner.type : typeof e.name === "string" && e.name !== "Error" ? e.name : null;
  const message = typeof inner?.message === "string" ? inner.message : err instanceof Error ? err.message : String(err);
  const requestId = typeof e.requestID === "string" ? e.requestID : typeof e.request_id === "string" ? e.request_id : null;
  return { status, type, message: message.slice(0, 300), requestId };
}

/** One line for the log: what failed and why, in Anthropic's own words. */
export function describeAiError(err: unknown): string {
  const f = factsOf(err);
  return [f.status !== null ? `HTTP ${f.status}` : "no HTTP answer", f.type, f.message, f.requestId ? `(request ${f.requestId})` : null]
    .filter(Boolean)
    .join(" ");
}

export function logAiError(kind: string, err: unknown): void {
  console.error(`[ai] ${kind} failed: ${describeAiError(err)}`);
}

export const AI_MESSAGES = {
  auth: "Claude help is not set up correctly on this site right now. Please tell the person who runs the app.",
  limit: "Claude help has reached its spending limit for now. Please tell the person who runs the app.",
  model: "The Claude model this app is set to use is not available. Please tell the person who runs the app.",
  busy: "Claude is busy right now. Try again in a minute.",
  down: "Claude is temporarily unavailable. Try again in a little while.",
  other: "Claude could not answer just now. Try again in a little while.",
} as const;

/** The sentence a person sees, and the HTTP status to answer with, for a failed Claude call. */
export function explainAiError(err: unknown): { message: string; status: number } {
  const f = factsOf(err);
  if (f.status === 401 || f.status === 403) return { message: AI_MESSAGES.auth, status: 502 };
  if (f.status === 429) return { message: AI_MESSAGES.busy, status: 429 };
  if (/credit balance|spend limit|usage limit|billing/i.test(f.message)) return { message: AI_MESSAGES.limit, status: 502 };
  if (f.status === 404) return { message: AI_MESSAGES.model, status: 502 };
  if (f.status === null || f.status >= 500) return { message: AI_MESSAGES.down, status: 503 };
  return { message: AI_MESSAGES.other, status: 502 };
}

/** A JSON answer for a failed Claude call: logs the reason, tells the person in plain words. */
export function aiFailure(kind: string, err: unknown): Response {
  logAiError(kind, err);
  const { message, status } = explainAiError(err);
  return Response.json({ error: message, code: "ai_unavailable" }, { status });
}
