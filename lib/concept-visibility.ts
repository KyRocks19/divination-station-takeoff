import { query, queryOne } from "./db";
import { adultConfirmed } from "./adult";

// Which shared concepts a person sees. A concept marked 'hidden' is shown to nobody; one marked 'reveal' only to a person who turned on
// "Show sensitive meanings" (users.show_sensitive, off for everyone until they choose). The columns come from migration 084.

/** The SQL condition on alias `c` (concepts) for what this person may see. */
export function visibleClause(show: boolean): string {
  return show ? "c.sensitivity IS DISTINCT FROM 'hidden'" : "c.sensitivity IS NULL";
}

/** Whether this person turned on "Show sensitive meanings". */
export async function showsSensitive(userId: number): Promise<boolean> {
  const row = await queryOne<{ show_sensitive: boolean }>("SELECT show_sensitive FROM users WHERE id = $1", [userId]);
  // Also needs "I am 18 or older" (lib/adult.ts, migration 092).
  return row?.show_sensitive === true && (await adultConfirmed(userId));
}

/**
 * Runs a query over concepts (alias `c`) written with `{visible}` where the visibility condition goes, `{aliases}` where the
 * older-wording column goes and `{sensitivity}` where the mark goes.
 */
export async function conceptQuery<T = any>(template: string, params: unknown[], show: boolean): Promise<T[]> {
  return query<T>(template.replaceAll("{visible}", visibleClause(show)).replaceAll("{aliases}", "c.aliases").replaceAll("{sensitivity}", "c.sensitivity"), params as any[]);
}

/** How many concepts in all are marked sensitive. */
export async function sensitiveCount(): Promise<number> {
  const row = await queryOne<{ n: string }>("SELECT COUNT(*) AS n FROM concepts WHERE sensitivity = 'reveal'");
  return Number(row?.n ?? 0);
}

/** How many of the concepts on a card are held back for a person who has not turned sensitive meanings on. */
export async function withheldOnCard(cardId: string): Promise<number> {
  const row = await queryOne<{ n: string }>(
    `SELECT COUNT(DISTINCT c.id) AS n FROM card_concepts cc JOIN concepts c ON c.id = cc.concept_id
      WHERE cc.card_id = $1 AND c.sensitivity = 'reveal'`,
    [cardId]
  );
  return Number(row?.n ?? 0);
}
