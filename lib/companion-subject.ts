import { buildItemContext, buildPullContext, type CompanionContext } from "./companion-context";
import { buildToolContext, divinationKind, isToolKind } from "./companion-context-tools";
import type { CompanionMode } from "./companion-modes";
import { buildNoticedContext } from "./companion-noticed";
import { buildPatternContext } from "./companion-pattern";

// What a companion request is about: a reading (any oracle pull, and readings with every other tool except blind-target practice) or, for picture ideas, one oracle
// item. This file only decides which builder to use; the builders read the person's own rows.

export type Subject =
  | { divinationId: number; cardId?: undefined; self?: undefined; pattern?: undefined }
  | { cardId: number; divinationId?: undefined; self?: undefined; pattern?: undefined }
  // A pattern on the Patterns page, named by its tool and symbol ("runes:rune-fehu"): for questions about it, from the person's own dates and words.
  | { pattern: string; divinationId?: undefined; cardId?: undefined; self?: undefined }
  // The person themselves: for a suggested line for their "what I have noticed" note (counts the app made in code).
  | { self: true; divinationId?: undefined; cardId?: undefined; pattern?: undefined };

/** The person's words for this subject and mode, or null when it is not theirs, not supported, or the wrong kind of subject for the mode. */
export async function buildContextFor(userId: number, subject: Subject, mode: CompanionMode): Promise<CompanionContext | null> {
  if (subject.pattern !== undefined) return mode === "pattern" ? buildPatternContext(userId, subject.pattern) : null;
  if (subject.self) return mode === "noticed" ? buildNoticedContext(userId) : null;
  if (mode === "noticed" || mode === "pattern") return null;
  if (subject.cardId !== undefined) return mode === "scene" ? buildItemContext(userId, subject.cardId) : null;
  if (mode === "scene") return null;
  const kind = await divinationKind(userId, subject.divinationId);
  const history = mode === "changes";
  if (kind === "oracle") return buildPullContext(userId, subject.divinationId, { history });
  if (kind && isToolKind(kind)) return buildToolContext(userId, subject.divinationId, kind, { history });
  return null;
}

/**
 * Which buttons a reading can have: every supported reading can be asked for questions and a reading from its words; "what has changed"
 * needs something earlier to set beside today's words. `supported` is false for kinds the companion does not cover.
 */
export async function capabilitiesFor(userId: number, divinationId: number): Promise<{ supported: boolean; changes: boolean }> {
  const ctx = await buildContextFor(userId, { divinationId }, "changes");
  return { supported: ctx !== null, changes: ctx?.hasHistory === true };
}
