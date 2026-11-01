// The parts of a person's Claude tool tokens (open item S2) that need no database, so the Settings page in the browser can use them. No imports.

/** A Claude tool token starts with this, so it is told apart from the shared CLAUDE_API_KEY and from a picture computer's dsw_ token. */
export const CLAUDE_TOKEN_PREFIX = "dsc_";
export const MAX_TOKEN_NAME = 60;
/** The most tokens one person can have in use at once. */
export const MAX_PERSONAL_TOKENS = 5;

export interface PersonalTokenRow {
  id: number;
  name: string;
  created_at: string;
  last_used_at: string | null;
}

/** The name a person gave a token, trimmed, or a sentence saying what is wrong with it. */
export function cleanTokenName(input: unknown): { ok: true; name: string } | { ok: false; error: string } {
  const name = typeof input === "string" ? input.trim() : "";
  if (!name) return { ok: false, error: "Give the token a name, such as what will use it." };
  if (name.length > MAX_TOKEN_NAME) return { ok: false, error: `The name can be ${MAX_TOKEN_NAME} characters at most.` };
  return { ok: true, name };
}

/**
 * The token a request carries: `X-Claude-Key: dsc_...` or `Authorization: Bearer dsc_...`. Null when there is none of that shape
 * (the old shared key, which has no prefix, is handled apart).
 */
export function personalTokenFrom(headers: { get(name: string): string | null }): string | null {
  const candidates = [headers.get("x-claude-key"), (headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "")];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && t.startsWith(CLAUDE_TOKEN_PREFIX) && t.length >= CLAUDE_TOKEN_PREFIX.length + 20 && t.length <= 200) return t;
  }
  return null;
}
