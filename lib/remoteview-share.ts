import { randomUUID } from "node:crypto";
import { query, queryOne } from "./db";

// Opt-in sharing of trial facts (migration 086). When a person has turned it on, each judged trial adds one row of five facts under a random code: which kind
// of trial, how many options, hit or miss, its place in the person's own sequence of trials, and the week. Nothing else is kept. Sharing is off until the
// person turns it on. Every function is for one person.

export interface ShareState {
  on: boolean;
  facts: number;
}

export async function shareState(userId: number): Promise<ShareState> {
  const row = await queryOne<{ token: string; n: number }>(
    "SELECT s.token, (SELECT COUNT(*)::int FROM remoteview_facts f WHERE f.token = s.token) AS n FROM remoteview_share s WHERE s.user_id = $1",
    [userId]
  );
  return { on: !!row, facts: row?.n ?? 0 };
}

/** Turns sharing on (a new random code, kept only here). */
export async function turnOn(userId: number): Promise<void> {
  await query("INSERT INTO remoteview_share (user_id, token) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING", [userId, randomUUID()]);
}

/** Turns sharing off and deletes every fact kept under the person's code, and the code. */
export async function turnOff(userId: number): Promise<void> {
  await query("DELETE FROM remoteview_share WHERE user_id = $1", [userId]);
}

/** Adds the facts of one judged trial when the person has sharing on; otherwise does nothing. Never throws: a failure here must not undo a judged trial. */
export async function recordFact(userId: number, tool: "blind4" | "daily5", options: number, hit: boolean): Promise<void> {
  try {
    await query(
      `INSERT INTO remoteview_facts (token, tool, options, hit, seq, week)
       SELECT s.token, $2, $3, $4, (SELECT COUNT(*)::int + 1 FROM remoteview_facts f WHERE f.token = s.token), date_trunc('week', NOW())::date
       FROM remoteview_share s WHERE s.user_id = $1`,
      [userId, tool, options, hit]
    );
  } catch (err) {
    console.error("[remoteview] could not record a shared fact", err);
  }
}

/** The facts kept under the person's code, for their own export. */
export async function ownFacts(userId: number) {
  return query<{ tool: string; options: number; hit: boolean; seq: number; week: string }>(
    `SELECT f.tool, f.options, f.hit, f.seq, f.week::text AS week FROM remoteview_facts f JOIN remoteview_share s ON s.token = f.token WHERE s.user_id = $1 ORDER BY f.seq, f.id`,
    [userId]
  );
}
