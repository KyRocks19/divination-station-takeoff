import { query } from "./db";
import { DIVINATION_KIND_LABELS, divinationPath, type DivinationKind } from "./divination-kinds";
import { GUESS_NUDGE_AFTER_HOURS, NUDGES_PER_KIND, type Nudge, type NudgeKind } from "./nudges-core";

export * from "./nudges-core";

/**
 * The person's nudges that they have not dismissed: predictions whose date has come (every tool, as before), then
 * readings of their starred tools that are at least a week old and have no look-back entry yet. A tarot reading's
 * look-back entries point at `readings`, the others' at `divinations`. Both kinds were on the home page until 2026-10-15.
 */
export async function listNudges(userId: number, tools: DivinationKind[] | null): Promise<Nudge[]> {
  const [due, lookbacks] = await Promise.all([
    query<{ id: number; text: string; divination_id: number; kind: DivinationKind; reading_id: number | null }>(
      `SELECT p.id, p.text, d.id AS divination_id, d.kind, d.reading_id
       FROM predictions p JOIN divinations d ON d.id = p.divination_id
       WHERE p.user_id = $1 AND p.outcome IS NULL AND p.check_on IS NOT NULL AND p.check_on <= CURRENT_DATE
         AND NOT EXISTS (SELECT 1 FROM nudge_dismissals n WHERE n.user_id = $1 AND n.kind = 'prediction' AND n.target_id = p.id)
       ORDER BY p.check_on, p.id LIMIT $2`,
      [userId, NUDGES_PER_KIND]
    ),
    query<{ id: number; kind: DivinationKind; reading_id: number | null; label: string; question: string | null }>(
      `SELECT d.id, d.kind, d.reading_id, COALESCE(NULLIF(r.title, ''), NULLIF(d.title, ''), r.spread_name, NULLIF(d.summary, ''), d.kind) AS label,
              d.question
       FROM divinations d
       LEFT JOIN readings r ON r.id = d.reading_id
       WHERE d.user_id = $1
         AND ($2::text[] IS NULL OR d.kind = ANY($2::text[]))
         AND d.created_at < NOW() - INTERVAL '7 days'
         AND NOT EXISTS (
           SELECT 1 FROM journals j
           WHERE j.kind = 'lookback' AND (j.divination_id = d.id OR (d.reading_id IS NOT NULL AND j.reading_id = d.reading_id))
         )
         AND NOT EXISTS (SELECT 1 FROM nudge_dismissals n WHERE n.user_id = $1 AND n.kind = 'lookback' AND n.target_id = d.id)
       ORDER BY d.created_at DESC, d.id DESC LIMIT $3`,
      [userId, tools, NUDGES_PER_KIND]
    ),
  ]);
  const [guesses, reminders] = await Promise.all([listGuessNudges(userId, tools), listReminderNudges(userId)]);
  const reminded = new Set(reminders.map((r) => r.id));
  return [
    ...reminders,
    ...due.map((p) => ({
      kind: "prediction" as const,
      id: p.id,
      href: divinationPath(p.kind, p.divination_id, p.reading_id),
      text: p.text,
      detail: DIVINATION_KIND_LABELS[p.kind] ?? "Reading",
      tool: p.kind,
    })),
    ...lookbacks.filter((r) => !reminded.has(r.id)).map((r) => ({
      kind: "lookback" as const,
      id: r.id,
      href: divinationPath(r.kind, r.id, r.reading_id),
      text: r.label,
      detail: `${DIVINATION_KIND_LABELS[r.kind] ?? "Reading"}${r.question ? ` · ${r.question}` : ""}`,
      tool: r.kind,
    })),
    ...guesses,
  ];
}

/**
 * Readings the person asked to be reminded to look back on (migration 092, any tool, whatever the starred tools), once the day has come and
 * until they write a look-back entry on or after it or dismiss the reminder.
 */
async function listReminderNudges(userId: number): Promise<Nudge[]> {
  const rows = await query<{ id: number; kind: DivinationKind; reading_id: number | null; label: string; question: string | null }>(
    `SELECT d.id, d.kind, d.reading_id, COALESCE(NULLIF(r.title, ''), NULLIF(d.title, ''), r.spread_name, NULLIF(d.summary, ''), d.kind) AS label,
            d.question
     FROM divinations d
     LEFT JOIN readings r ON r.id = d.reading_id
     WHERE d.user_id = $1 AND d.look_back_on IS NOT NULL AND d.look_back_on <= CURRENT_DATE
       AND NOT EXISTS (
         SELECT 1 FROM journals j
         WHERE j.kind = 'lookback' AND j.created_at >= d.look_back_on
           AND (j.divination_id = d.id OR (d.reading_id IS NOT NULL AND j.reading_id = d.reading_id))
       )
       AND NOT EXISTS (SELECT 1 FROM nudge_dismissals n WHERE n.user_id = $1 AND n.kind = 'lookback' AND n.target_id = d.id)
     ORDER BY d.look_back_on, d.id LIMIT $2`,
    [userId, NUDGES_PER_KIND]
  );
  return rows.map((r) => ({
    kind: "lookback" as const,
    id: r.id,
    href: divinationPath(r.kind, r.id, r.reading_id),
    text: r.label,
    detail: `${DIVINATION_KIND_LABELS[r.kind] ?? "Reading"}${r.question ? ` · ${r.question}` : ""}`,
    tool: r.kind,
    lead: "You asked to look back on this reading around now",
  }));
}

/**
 * Written guesses (never set-aside ones) sealed at least a day ago with no fit answer yet, on readings of the starred tools, leaving out
 * the ones the person dismissed.
 */
async function listGuessNudges(userId: number, tools: DivinationKind[] | null): Promise<Nudge[]> {
  const rows = await query<{ id: number; kind: DivinationKind; reading_id: number | null; guess: string; question: string | null }>(
    `SELECT d.id, d.kind, d.reading_id, g.guess, d.question
     FROM reading_guesses g JOIN divinations d ON d.id = g.divination_id AND d.user_id = g.user_id
     WHERE g.user_id = $1 AND NOT g.skipped AND g.fit IS NULL
       AND ($2::text[] IS NULL OR d.kind = ANY($2::text[]))
       AND g.sealed_at < NOW() - make_interval(hours => $4)
       AND NOT EXISTS (SELECT 1 FROM nudge_dismissals n WHERE n.user_id = $1 AND n.kind = 'guess' AND n.target_id = d.id)
     ORDER BY g.sealed_at DESC, d.id DESC LIMIT $3`,
    [userId, tools, NUDGES_PER_KIND, GUESS_NUDGE_AFTER_HOURS]
  );
  return rows.map((r) => ({
    kind: "guess" as const,
    id: r.id,
    href: divinationPath(r.kind, r.id, r.reading_id),
    text: r.guess,
    detail: `${DIVINATION_KIND_LABELS[r.kind] ?? "Reading"}${r.question ? ` · ${r.question}` : ""}`,
    tool: r.kind,
  }));
}

/** Dismisses one nudge for good. Only the person's own: a prediction or reading of someone else is never touched. */
export async function dismissNudge(userId: number, kind: NudgeKind, id: number): Promise<boolean> {
  const owned =
    kind === "prediction"
      ? await query("SELECT 1 FROM predictions WHERE id = $1 AND user_id = $2", [id, userId])
      : kind === "guess"
        ? await query("SELECT 1 FROM reading_guesses WHERE divination_id = $1 AND user_id = $2", [id, userId])
        : await query("SELECT 1 FROM divinations WHERE id = $1 AND user_id = $2", [id, userId]);
  if (owned.length === 0) return false;
  await query(
    `INSERT INTO nudge_dismissals (user_id, kind, target_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [userId, kind, id]
  );
  return true;
}
