// A person's own archetypes, concepts and links to pieces: the limits, and the cleaning of what they send. Pure, so it can
// be tested without a database. lib/own-archetypes.ts does the database half. Everything here is the person's own words:
// plain text only, never read as markup, kept private to them.

import { SYMBOL_ID_SHAPE, isKnownSymbolId } from "./symbol-ids";
import { MAX } from "./own-limits";

export { LIMITS, MAX } from "./own-limits";

export type Result<T> = { ok: true; value: T } | { ok: false; error: string };

const bad = <T>(error: string): Result<T> => ({ ok: false, error });
const good = <T>(value: T): Result<T> => ({ ok: true, value });

// Control characters (except a tab and a line break) are dropped; the rest is kept as the person wrote it.
// eslint-disable-next-line no-control-regex
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** One line: tidy spaces, no line breaks. Empty becomes "". */
export function oneLine(value: unknown): string {
  return typeof value === "string" ? value.replace(CONTROL, "").replace(/\s+/g, " ").trim() : "";
}

/** Several lines allowed: trailing spaces and blank runs tidied. */
export function manyLines(value: unknown): string {
  return typeof value === "string"
    ? value.replace(CONTROL, "").replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim()
    : "";
}

function name(value: unknown): Result<string> {
  const v = oneLine(value);
  if (!v) return bad("A name is needed");
  if (v.length > MAX.name) return bad(`A name can be at most ${MAX.name} characters`);
  return good(v);
}

function capped(value: unknown, max: number, label: string, lines: boolean): Result<string> {
  if (value === undefined || value === null) return good("");
  if (typeof value !== "string") return bad(`${label} must be text`);
  const v = lines ? manyLines(value) : oneLine(value);
  if (v.length > max) return bad(`${label} can be at most ${max} characters`);
  return good(v);
}

export interface ArchetypeInput {
  name: string;
  realm: string | null;
  summary: string;
  light: string;
  shadow: string;
}

export function cleanArchetype(body: unknown): Result<ArchetypeInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const n = name(b.name);
  if (!n.ok) return n;
  const realm = capped(b.realm, MAX.realm, "The group heading", false);
  const summary = capped(b.summary, MAX.summary, "The summary", true);
  const light = capped(b.light, MAX.side, "The good side", true);
  const shadow = capped(b.shadow, MAX.side, "The hard side", true);
  for (const r of [realm, summary, light, shadow]) if (!r.ok) return r;
  return good({
    name: n.value,
    realm: (realm as { value: string }).value || null,
    summary: (summary as { value: string }).value,
    light: (light as { value: string }).value,
    shadow: (shadow as { value: string }).value,
  });
}

export interface ConceptInput {
  name: string;
  description: string;
  /** Under a shared archetype (its slug), under one of the person's own (its id), or neither. Never both. */
  sharedSlug: string | null;
  userArchetypeId: number | null;
  /** The concept's own realm (migration 101); null to take the realm of the archetype it sits under. */
  realm: string | null;
}

export function cleanConcept(body: unknown): Result<ConceptInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const n = name(b.name);
  if (!n.ok) return n;
  const description = capped(b.description, MAX.description, "The description", true);
  if (!description.ok) return description;
  const realm = capped(b.realm, MAX.realm, "The realm", false);
  if (!realm.ok) return realm;
  const slug = typeof b.shared_archetype === "string" && b.shared_archetype ? b.shared_archetype : null;
  if (slug !== null && !/^[a-z-]{1,60}$/.test(slug)) return bad("That is not an archetype");
  const own = b.user_archetype_id === undefined || b.user_archetype_id === null ? null : b.user_archetype_id;
  if (own !== null && !(Number.isInteger(own) && (own as number) > 0)) return bad("That is not one of your archetypes");
  if (slug !== null && own !== null) return bad("A concept sits under one archetype, not two");
  return good({ name: n.value, description: description.value, sharedSlug: slug, userArchetypeId: own as number | null, realm: realm.value || null });
}

export type Aspect = "light" | "shadow" | "neutral";
export const ASPECTS: Aspect[] = ["light", "shadow", "neutral"];

export type LinkTarget =
  | { kind: "archetype"; slug: string }
  | { kind: "user_archetype"; id: number }
  | { kind: "user_concept"; id: number };

export type LinkPiece = { kind: "symbol"; id: string } | { kind: "oracle_card"; id: number };

export interface LinkInput {
  piece: LinkPiece;
  target: LinkTarget;
  aspect: Aspect;
}

const positive = (n: unknown): n is number => typeof n === "number" && Number.isInteger(n) && n > 0;

/** Reads a piece out of a request's fields: either symbol_id (a shared piece) or oracle_card_id (the person's own item). */
export function cleanPiece(b: Record<string, unknown>): Result<LinkPiece> {
  const hasSymbol = b.symbol_id !== undefined && b.symbol_id !== null && b.symbol_id !== "";
  const hasOracle = b.oracle_card_id !== undefined && b.oracle_card_id !== null && b.oracle_card_id !== "";
  if (hasSymbol === hasOracle) return bad("Name one piece: symbol_id or oracle_card_id");
  if (hasSymbol) {
    if (typeof b.symbol_id !== "string" || !SYMBOL_ID_SHAPE.test(b.symbol_id) || !isKnownSymbolId(b.symbol_id)) return bad("That is not a piece of any set");
    return good({ kind: "symbol", id: b.symbol_id });
  }
  const id = typeof b.oracle_card_id === "string" ? Number(b.oracle_card_id) : b.oracle_card_id;
  if (!positive(id)) return bad("That is not one of your oracle items");
  return good({ kind: "oracle_card", id });
}

export function cleanLink(body: unknown): Result<LinkInput> {
  const b = (body ?? {}) as Record<string, unknown>;
  const piece = cleanPiece(b);
  if (!piece.ok) return piece;
  const targets = [b.archetype, b.user_archetype_id, b.user_concept_id].filter((x) => x !== undefined && x !== null && x !== "");
  if (targets.length !== 1) return bad("Name one thing to link to: archetype, user_archetype_id or user_concept_id");
  let target: LinkTarget;
  if (typeof b.archetype === "string" && b.archetype) {
    if (!/^[a-z-]{1,60}$/.test(b.archetype)) return bad("That is not an archetype");
    target = { kind: "archetype", slug: b.archetype };
  } else if (b.user_archetype_id !== undefined && b.user_archetype_id !== null) {
    if (!positive(b.user_archetype_id)) return bad("That is not one of your archetypes");
    target = { kind: "user_archetype", id: b.user_archetype_id };
  } else if (positive(b.user_concept_id)) {
    target = { kind: "user_concept", id: b.user_concept_id };
  } else {
    return bad("That is not one of your concepts");
  }
  const aspect = b.aspect === undefined || b.aspect === null ? "neutral" : b.aspect;
  if (!ASPECTS.includes(aspect as Aspect)) return bad("The side must be light, shadow or neutral");
  return good({ piece: piece.value, target, aspect: aspect as Aspect });
}

/** True when adding one more would go over the limit. */
export function atLimit(count: number, limit: number): boolean {
  return count >= limit;
}
