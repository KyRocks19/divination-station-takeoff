import { DIVINATION_KINDS, type DivinationKind } from "./divination-kinds";

// How a pattern on the Patterns page is named when the companion is asked about it. Pure, so the page (which runs in the browser) can use it;
// the builder that reads the person's rows is lib/companion-pattern.ts.

/** A pattern is named by its tool and the symbol's own key: "runes:rune-fehu". The key may itself hold colons ("dice:d6:3"). */
export const PATTERN_REF_RE = /^[a-z]+:[A-Za-z0-9_.:-]{1,100}$/;
export const patternRef = (kind: DivinationKind, key: string) => `${kind}:${key}`;

export function parsePatternRef(ref: unknown): { kind: DivinationKind; key: string } | null {
  if (typeof ref !== "string" || !PATTERN_REF_RE.test(ref)) return null;
  const cut = ref.indexOf(":");
  const kind = ref.slice(0, cut);
  const key = ref.slice(cut + 1);
  return (DIVINATION_KINDS as string[]).includes(kind) && key ? { kind: kind as DivinationKind, key } : null;
}
