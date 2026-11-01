// Reads how often the pieces a person linked to their own archetypes and concepts came up in their readings (see
// lib/own-tallies-core.ts for the counting). Server code only: it imports the database. Every query is for one person.

import { query } from "@/lib/db";
import { faceId, type DiceObjectId } from "@/lib/dice-data";
import { pendulumKey } from "@/lib/common-meanings-data";
import { allOwnLinks } from "@/lib/own-archetypes";
import { ownThemesByMonth, tallyOwn, type DrawCount, type OwnMonthThemes, type OwnTally } from "@/lib/own-tallies-core";
import type { DivinationKind } from "@/lib/divination-kinds";

const MONTH = (col: string) => `to_char(${col} AT TIME ZONE 'UTC', 'YYYY-MM')`;

/**
 * The hexagrams (both of a cast) and the geomantic figures (the Mothers and the Judge) that came up, by month.
 */
async function newToolDraws(userId: number, only: DivinationKind[] | null): Promise<DrawCount[]> {
  const wants = (k: DivinationKind) => only === null || only.includes(k);
  const [iching, geomancy] = await Promise.all([
    wants("iching")
      ? query<{ id: string; month: string; n: string }>(
          `SELECT 'hexagram-' || h.num AS id, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
             FROM (SELECT divination_id, primary_number AS num FROM iching_casts WHERE user_id = $1
                   UNION ALL SELECT divination_id, relating_number FROM iching_casts WHERE user_id = $1 AND relating_number IS NOT NULL) h
             JOIN divinations dv ON dv.id = h.divination_id GROUP BY 1, 2`, [userId])
      : Promise.resolve([] as never[]),
    wants("geomancy")
      ? query<{ id: string; month: string; n: string }>(
          `SELECT f.figure_id AS id, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n FROM geomancy_figures f JOIN divinations dv ON dv.id = f.divination_id
            WHERE f.user_id = $1 AND (f.place LIKE 'mother%' OR f.place = 'judge') GROUP BY f.figure_id, month`, [userId])
      : Promise.resolve([] as never[]),
  ]);
  return [
    ...iching.map((r) => ({ tool: "iching" as const, piece: r.id, n: Number(r.n), month: r.month })),
    ...geomancy.map((r) => ({ tool: "geomancy" as const, piece: r.id, n: Number(r.n), month: r.month })),
  ];
}

/** Every piece that came up in the person's readings, counted by month, for the tools given (null for every tool). */
async function monthlyDraws(userId: number, only: DivinationKind[] | null): Promise<DrawCount[]> {
  const wants = (k: DivinationKind) => only === null || only.includes(k);
  const none = Promise.resolve([] as never[]);
  const [tarot, runes, ogham, dice, pendulum, scrying, oracle] = await Promise.all([
    wants("tarot")
      ? query<{ id: string; month: string; n: string }>(
          `SELECT card_id AS id, ${MONTH("created_at")} AS month, COUNT(*) AS n FROM card_draws
            WHERE user_id = $1 AND is_clarifier = 0 GROUP BY card_id, month`, [userId])
      : none,
    wants("runes")
      ? query<{ id: string; month: string; n: string }>(
          `SELECT r.rune_id AS id, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n FROM rune_draws r JOIN divinations dv ON dv.id = r.divination_id
            WHERE r.user_id = $1 GROUP BY r.rune_id, month`, [userId])
      : none,
    wants("ogham")
      ? query<{ id: string; month: string; n: string }>(
          `SELECT o.stave_id AS id, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n FROM ogham_draws o JOIN divinations dv ON dv.id = o.divination_id
            WHERE o.user_id = $1 GROUP BY o.stave_id, month`, [userId])
      : none,
    wants("dice")
      ? query<{ object: string; face: string; month: string; n: string }>(
          `SELECT t.object, t.face, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n FROM dice_throws t JOIN divinations dv ON dv.id = t.divination_id
            WHERE t.user_id = $1 GROUP BY t.object, t.face, month`, [userId])
      : none,
    wants("pendulum")
      ? query<{ shape: string; angle: number | null; builtin: number | null; month: string; n: string }>(
          `SELECT a.shape, a.angle, s.builtin, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n
             FROM pendulum_answers a JOIN divinations dv ON dv.id = a.divination_id LEFT JOIN pendulum_swings s ON s.id = a.swing_id
            WHERE a.user_id = $1 GROUP BY a.shape, a.angle, s.builtin, month`, [userId])
      : none,
    wants("scrying")
      ? query<{ surface: string; month: string; n: string }>(
          `SELECT sc.surface, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n FROM scrying_sessions sc JOIN divinations dv ON dv.id = sc.divination_id
            WHERE sc.user_id = $1 GROUP BY sc.surface, month`, [userId])
      : none,
    wants("oracle")
      ? query<{ id: number; month: string; n: string }>(
          `SELECT c.card_id AS id, ${MONTH("dv.created_at")} AS month, COUNT(*) AS n FROM oracle_pull_cards c JOIN divinations dv ON dv.id = c.divination_id
            WHERE c.user_id = $1 AND c.card_id IS NOT NULL GROUP BY c.card_id, month`, [userId])
      : none,
  ]);
  return [
    ...(await newToolDraws(userId, only)),
    ...tarot.map((r) => ({ tool: "tarot" as const, piece: r.id, n: Number(r.n), month: r.month })),
    ...runes.map((r) => ({ tool: "runes" as const, piece: r.id, n: Number(r.n), month: r.month })),
    ...ogham.map((r) => ({ tool: "ogham" as const, piece: r.id, n: Number(r.n), month: r.month })),
    ...dice.map((r) => ({ tool: "dice" as const, piece: faceId(r.object as DiceObjectId, r.face), n: Number(r.n), month: r.month })),
    ...pendulum.flatMap((r) => {
      const key = pendulumKey({ shape: r.shape, angle: r.angle, builtin: r.builtin ?? 1 }) ?? (r.shape === "line" && r.angle !== null ? `swing-line-${r.angle}` : null);
      return key ? [{ tool: "pendulum" as const, piece: key, n: Number(r.n), month: r.month }] : [];
    }),
    ...scrying.map((r) => ({ tool: "scrying" as const, piece: `scrying-${r.surface}`, n: Number(r.n), month: r.month })),
    ...oracle.map((r) => ({ tool: "oracle" as const, piece: `oracle:${r.id}`, n: Number(r.n), month: r.month })),
  ];
}

/** The person's own archetypes and concepts that came up, most often first, for the tools given (null for every tool). Empty if they have linked nothing. */
export async function ownTallies(userId: number, only: DivinationKind[] | null = null): Promise<OwnTally[]> {
  const links = await allOwnLinks(userId);
  if (links.length === 0) return [];
  return tallyOwn(links, await monthlyDraws(userId, only));
}

/** The same, month by month, for their own archetypes and concepts only, for the tools given (null for every tool). */
export async function ownThemeMonths(userId: number, only: DivinationKind[] | null): Promise<OwnMonthThemes[]> {
  const links = await allOwnLinks(userId);
  if (links.every((l) => l.target.kind === "archetype")) return [];
  return ownThemesByMonth(links, await monthlyDraws(userId, only));
}
