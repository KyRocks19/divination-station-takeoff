import { query } from "./db";
import { buildContextFor } from "./companion-subject";
import { loadRecurring } from "./patterns-symbols";
import type { DivinationKind } from "./divination-kinds";
import type { CrossToolInput } from "./guide-prompts";

// What the guide and the pattern reading are given about the person's readings with every tool (open item Y3). Everything here is read from the
// person's own rows: counts, the names of what came up, and the own-words text lib/companion-subject.ts builds for each reading (no stock meaning).

/** How many readings the person has made with each tool, most used first. */
export async function readingCounts(userId: number): Promise<{ kind: DivinationKind; n: number }[]> {
  const rows = await query<{ kind: DivinationKind; n: number }>(
    "SELECT kind, COUNT(*)::int AS n FROM divinations WHERE user_id = $1 GROUP BY kind ORDER BY n DESC, kind",
    [userId]
  );
  return rows;
}

/**
 * The cross-tool section for a person. `excludeDivinationId` is the reading the guide is already looking at. With `withTarot` false the tarot readings are
 * left out of the list of readings (the tarot guide already holds them in full) but still counted.
 */
export async function loadCrossTool(
  userId: number,
  opts: { excludeDivinationId?: number | null; withTarot: boolean; limit?: number }
): Promise<CrossToolInput> {
  const limit = opts.limit ?? 8;
  const [counts, recurring, recent] = await Promise.all([
    readingCounts(userId),
    loadRecurring(userId, null),
    query<{ id: number }>(
      `SELECT id FROM divinations
       WHERE user_id = $1 AND id <> $2 AND ($3::boolean OR kind <> 'tarot')
       ORDER BY created_at DESC, id DESC LIMIT ${limit}`,
      [userId, opts.excludeDivinationId ?? 0, opts.withTarot]
    ),
  ]);
  const contexts = await Promise.all(recent.map((r) => buildContextFor(userId, { divinationId: r.id }, "questions")));
  const kinds = await query<{ id: number; kind: DivinationKind }>("SELECT id, kind FROM divinations WHERE user_id = $1 AND id = ANY($2)", [userId, recent.map((r) => r.id)]);
  const kindOf = new Map(kinds.map((k) => [k.id, k.kind]));
  const readings: CrossToolInput["readings"] = [];
  recent.forEach((r, i) => {
    const ctx = contexts[i];
    const kind = kindOf.get(r.id);
    if (ctx && kind) readings.push({ kind, text: ctx.text });
  });
  return {
    counts,
    recurring: recurring.filter((r) => r.kind !== "tarot").slice(0, 8).map((r) => ({ kind: r.kind, name: r.name, count: r.count })),
    readings,
  };
}
