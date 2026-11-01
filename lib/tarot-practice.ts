import { randomInt } from "node:crypto";
import { query, queryOne } from "./db";
import { TAROT_DECK } from "./cards";
import { summarize, type PracticeSuit, type PracticeSummary } from "./tarot-practice-core";

// Tarot practice, server side (migration 092). The card is chosen here with a cryptographic random number and stored before the person guesses;
// it is never sent to the browser until their guess is saved. Every function is scoped to the signed-in person.

export interface ShownCard {
  id: string;
  name: string;
  fileName: string;
}

export interface PracticeTrial {
  id: number;
  guess_suit: PracticeSuit | null;
  guess_words: string | null;
  created_at: string;
  /** Only once the guess is saved. */
  card: ShownCard | null;
}

const show = (cardId: string): ShownCard | null => {
  const c = TAROT_DECK.find((x) => x.id === cardId);
  return c ? { id: c.id, name: c.name, fileName: c.fileName } : null;
};

/** The person's sealed card that is waiting for a guess, or a new one. Returns only its id: the card stays hidden. */
export async function sealedTrial(userId: number): Promise<number> {
  const open = await queryOne<{ id: number }>(
    "SELECT id FROM tarot_practice WHERE user_id = $1 AND guessed_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 1",
    [userId]
  );
  if (open) return open.id;
  const card = TAROT_DECK[randomInt(TAROT_DECK.length)];
  const row = await queryOne<{ id: number }>("INSERT INTO tarot_practice (user_id, card_id) VALUES ($1, $2) RETURNING id", [userId, card.id]);
  return row!.id;
}

/** Saves the guess on a sealed card of the person's and returns the card. Null when it is not theirs or was already guessed. */
export async function guessTrial(userId: number, id: number, suit: PracticeSuit, words: string | null): Promise<ShownCard | null> {
  const row = await queryOne<{ card_id: string }>(
    `UPDATE tarot_practice SET guess_suit = $3, guess_words = $4, guessed_at = NOW()
     WHERE id = $1 AND user_id = $2 AND guessed_at IS NULL RETURNING card_id`,
    [id, userId, suit, words]
  );
  return row ? show(row.card_id) : null;
}

/** The person's guessed trials, newest first, with the plain numbers. */
export async function listTrials(userId: number): Promise<{ trials: PracticeTrial[]; summary: PracticeSummary }> {
  const rows = await query<{ id: number; card_id: string; guess_suit: PracticeSuit | null; guess_words: string | null; created_at: string }>(
    "SELECT id, card_id, guess_suit, guess_words, created_at FROM tarot_practice WHERE user_id = $1 AND guessed_at IS NOT NULL ORDER BY created_at DESC, id DESC",
    [userId]
  );
  return {
    trials: rows.map((r) => ({ id: r.id, guess_suit: r.guess_suit, guess_words: r.guess_words, created_at: r.created_at, card: show(r.card_id) })),
    summary: summarize(rows),
  };
}

/** Deletes every practice trial of the person's. Returns how many. */
export async function clearTrials(userId: number): Promise<number> {
  return (await query("DELETE FROM tarot_practice WHERE user_id = $1 RETURNING id", [userId])).length;
}
