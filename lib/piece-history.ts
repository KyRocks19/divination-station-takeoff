import { query } from "./db";
import { divinationPath, type DivinationKind } from "./divination-kinds";
import { loadDrawRows } from "./patterns-symbols";

// "Times this came up" for one piece of a tool (a rune, an ogham stave, a hexagram, a geomantic figure, a die face): the person's own readings in which it
// came up, newest first, with the question and how many entries they wrote about each. It is the same list tarot cards and oracle items already had, now for
// every tool with a set of pieces. Every query is for one person.

export interface CameUp {
  /** The shared record of the reading. */
  id: number;
  href: string;
  when: string;
  question: string | null;
  summary: string;
  entries: number;
}

const MAX = 30;

/** The person's readings of `kind` in which the piece with this key came up. `more` is true when there are more than are listed. */
export async function piecesCameUp(userId: number, kind: DivinationKind, key: string): Promise<{ items: CameUp[]; total: number; more: boolean }> {
  const rows = await loadDrawRows(userId, [kind]);
  const ids = [...new Set(rows.filter((r) => r.key === key).map((r) => r.divination_id))];
  if (ids.length === 0) return { items: [], total: 0, more: false };
  const found = await query<{ id: number; question: string | null; summary: string; created_at: string; reading_id: number | null; entries: number }>(
    `SELECT d.id, d.question, d.summary, d.created_at, d.reading_id,
            (SELECT COUNT(*)::int FROM journals j WHERE j.divination_id = d.id AND j.author = 'user') AS entries
     FROM divinations d WHERE d.user_id = $1 AND d.id = ANY($2) ORDER BY d.created_at DESC, d.id DESC LIMIT ${MAX}`,
    [userId, ids]
  );
  return {
    items: found.map((r) => ({
      id: r.id,
      href: divinationPath(kind, r.id, r.reading_id),
      when: new Date(r.created_at).toISOString(),
      question: r.question,
      summary: r.summary,
      entries: r.entries,
    })),
    total: ids.length,
    more: ids.length > MAX,
  };
}
