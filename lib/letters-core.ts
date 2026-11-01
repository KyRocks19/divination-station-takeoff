// Letters between members of a circle (migration 103, open item LP1), as plain data: no database code, so the Letters page, the reading
// pages and the tests can import it. lib/letters.ts reads and writes the rows.
//
// The shape: someone asks a question of one member or of the whole circle. A member picks it up, reads for it with any tool, and seals a
// letter in their own words. The asker opens it when they are ready and, later, may write back how it went. Only the asker's words and the
// reader's words are ever in a letter; the app adds nothing of its own, and no one scores, grades or rates a letter or a reply.

import { divinationPath, type DivinationKind } from "./divination-kinds";

export const MAX_QUESTION_LENGTH = 1000;
export const MAX_LETTER_LENGTH = 6000;
export const MAX_REPLY_LENGTH = 6000;
/** The most questions a person may have waiting (asked and not yet sealed by anyone), so one account cannot fill the database. */
export const MAX_WAITING_QUESTIONS = 20;
/** How far back a reader may choose one of their own readings to go with a letter. */
export const READING_CHOICE_DAYS = 14;

/** Where a letter is, for the person looking at it. */
export type LetterStage =
  | "waiting" // asked; no one has picked it up
  | "declined" // the member it was asked of said they would rather not
  | "reading" // a reader has picked it up and not sealed it yet
  | "sealed" // sent; the asker has not opened it
  | "opened" // the asker has opened it
  | "replied"; // the asker wrote back

/** The row as lib/letters.ts reads it, with names already joined. Never sent to the browser as it is: see `letterFor`. */
export interface LetterRow {
  id: number;
  circle_id: number | null;
  asker_id: number;
  asker_name: string;
  to_user_id: number | null;
  to_name: string | null;
  to_circle: boolean;
  question: string;
  blind: boolean;
  created_at: string;
  declined_at: string | null;
  reader_id: number | null;
  reader_name: string | null;
  taken_at: string | null;
  divination_id: number | null;
  /** The reader's reading, when it still exists. */
  divination_kind: DivinationKind | null;
  divination_reading_id: number | null;
  reading_line: string | null;
  letter: string | null;
  sealed_at: string | null;
  opened_at: string | null;
  write_back_on: string | null;
  reply: string | null;
  replied_at: string | null;
  reply_seen_at: string | null;
  reader_hidden_at: string | null;
}

/** What one person is allowed to see of a letter. */
export interface LetterView {
  id: number;
  /** "asker" when this person asked; "reader" when they are reading or have read for it; "offered" when it is waiting for them to pick up. */
  role: "asker" | "reader" | "offered";
  stage: LetterStage;
  asker_name: string;
  /** Who it was asked of: a member's name, or null for the whole circle. */
  to_name: string | null;
  to_circle: boolean;
  /** Null for a reader of a blind letter until they have sealed theirs. */
  question: string | null;
  blind: boolean;
  created_at: string;
  reader_name: string | null;
  /** Only the reader gets this: the page of their own reading, while it exists. */
  reading_href: string | null;
  reading_line: string | null;
  /** The asker sees the letter only once they choose to open it. The reader always sees the letter they sent. */
  letter: string | null;
  sealed_at: string | null;
  opened_at: string | null;
  /** The asker's own reminder date. Only the asker sees it. */
  write_back_on: string | null;
  reply: string | null;
  replied_at: string | null;
  /** For the reader: true until they have seen the reply. */
  reply_new: boolean;
}

export function stageOf(r: Pick<LetterRow, "declined_at" | "reader_id" | "sealed_at" | "opened_at" | "replied_at">): LetterStage {
  if (r.replied_at) return "replied";
  if (r.opened_at) return "opened";
  if (r.sealed_at) return "sealed";
  if (r.reader_id) return "reading";
  if (r.declined_at) return "declined";
  return "waiting";
}

/**
 * The letter as this person may see it, or null when it is not theirs to see. `offered` says the database already checked that the letter is
 * waiting for this person to pick up (asked of them, or of their circle while both are still in it). Pure, so the rules can be tested.
 */
export function letterFor(r: LetterRow, viewerId: number, offered = false): LetterView | null {
  const stage = stageOf(r);
  const role = r.asker_id === viewerId ? "asker" : r.reader_id === viewerId ? "reader" : offered && !r.reader_id && !r.declined_at ? "offered" : null;
  if (!role) return null;
  if (role === "reader" && r.reader_hidden_at) return null;
  const isAsker = role === "asker";
  const hideQuestion = !isAsker && r.blind && !r.sealed_at;
  return {
    id: r.id,
    role,
    stage,
    asker_name: r.asker_name,
    to_name: r.to_name,
    to_circle: r.to_circle,
    question: hideQuestion ? null : r.question,
    blind: r.blind,
    created_at: r.created_at,
    reader_name: r.reader_name,
    reading_href: role === "reader" && r.divination_id && r.divination_kind ? divinationPath(r.divination_kind, r.divination_id, r.divination_reading_id) : null,
    reading_line: isAsker && !r.opened_at ? null : r.reading_line,
    letter: isAsker && !r.opened_at ? null : r.letter,
    sealed_at: r.sealed_at,
    opened_at: r.opened_at,
    write_back_on: isAsker ? r.write_back_on : null,
    reply: r.reply,
    replied_at: r.replied_at,
    reply_new: role === "reader" && !!r.replied_at && !r.reply_seen_at,
  };
}

export type Cleaned = { ok: true; text: string } | { ok: false; error: string };

function cleanText(value: unknown, max: number, what: string): Cleaned {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return { ok: false, error: `Write ${what} first.` };
  if (text.length > max) return { ok: false, error: `That is too long (${max.toLocaleString("en-US")} characters at most).` };
  return { ok: true, text };
}

export const cleanQuestion = (v: unknown) => cleanText(v, MAX_QUESTION_LENGTH, "your question");
export const cleanLetter = (v: unknown) => cleanText(v, MAX_LETTER_LENGTH, "your letter");
export const cleanReply = (v: unknown) => cleanText(v, MAX_REPLY_LENGTH, "how it went");

/** A date typed as YYYY-MM-DD, or null when empty. `undefined` means it is not valid. */
export function cleanWriteBackOn(value: unknown): string | null | undefined {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? undefined : value;
}

/** Who a new question is for: one member by id, or the whole circle. Null when the body says neither. */
export function parseRecipient(value: unknown): { to: "circle" } | { to: "member"; id: number } | null {
  if (value === "circle") return { to: "circle" };
  const n = typeof value === "number" ? value : typeof value === "string" && /^\d+$/.test(value) ? Number(value) : NaN;
  return Number.isSafeInteger(n) && n > 0 && n <= 2147483647 ? { to: "member", id: n } : null;
}

/** What a PATCH on one letter may ask for. */
export const LETTER_ACTIONS = ["take", "put_back", "decline", "seal", "open", "write_back_on", "reply", "reply_seen", "ask_circle"] as const;
export type LetterAction = (typeof LETTER_ACTIONS)[number];

export function parseAction(value: unknown): LetterAction | null {
  return typeof value === "string" && (LETTER_ACTIONS as readonly string[]).includes(value) ? (value as LetterAction) : null;
}

/** The one line naming the reader's reading that goes with their letter: the tool and what came up, as the reading's own summary says it. */
export function readingLine(toolLabel: string, summary: string | null, title: string | null): string {
  const what = (summary ?? "").replace(/\s+/g, " ").trim() || (title ?? "").replace(/\s+/g, " ").trim();
  return (what ? `${toolLabel}: ${what}` : toolLabel).slice(0, 500);
}

/** Something on the Letters page or today's page that is waiting for this person to do, if they want to. */
export interface LetterNotice {
  kind: "asked_of_you" | "arrived" | "write_back" | "reply";
  id: number;
  /** A name: who asked, who sent the letter, or who wrote back. */
  name: string;
}

/** The notices for one person, from the letters they can see. Pure. `today` is YYYY-MM-DD in the person's own day. */
export function noticesFrom(letters: LetterView[], today: string): LetterNotice[] {
  const out: LetterNotice[] = [];
  for (const l of letters) {
    if (l.role === "offered" && !l.to_circle) out.push({ kind: "asked_of_you", id: l.id, name: l.asker_name });
    else if (l.role === "asker" && l.stage === "sealed") out.push({ kind: "arrived", id: l.id, name: l.reader_name ?? "Someone" });
    else if (l.role === "asker" && l.stage === "opened" && l.write_back_on && l.write_back_on <= today) out.push({ kind: "write_back", id: l.id, name: l.reader_name ?? "Someone" });
    else if (l.role === "reader" && l.reply_new) out.push({ kind: "reply", id: l.id, name: l.asker_name });
  }
  return out;
}

export function noticeText(n: LetterNotice): string {
  switch (n.kind) {
    case "asked_of_you":
      return `${n.name} asked you for a reading.`;
    case "arrived":
      return `A letter from ${n.name} has arrived. Open it when you are ready.`;
    case "write_back":
      return `You asked to be reminded to write back to ${n.name} around now.`;
    case "reply":
      return `${n.name} wrote back about your reading.`;
  }
}

// The data export holds only this person's own words: questions they asked, letters they sent and replies they wrote. Another member's
// words stay out, as with every other part of the export (lib/export-circle-core.ts).

export interface LetterExport {
  letters: {
    you_were: "asker" | "reader";
    with: string | null;
    asked_at: string;
    blind: boolean;
    /** Your question, when you asked. */
    your_question: string | null;
    /** Your letter and the line naming your reading, when you read. */
    your_letter: string | null;
    your_reading: string | null;
    sealed_at: string | null;
    /** Your reply, when you asked and wrote back. */
    your_reply: string | null;
    replied_at: string | null;
  }[];
}

export function shapeLetterExport(rows: LetterRow[], userId: number): LetterExport {
  const letters: LetterExport["letters"] = [];
  for (const r of rows) {
    if (r.asker_id === userId) {
      letters.push({
        you_were: "asker",
        with: r.reader_name ?? r.to_name,
        asked_at: r.created_at,
        blind: r.blind,
        your_question: r.question,
        your_letter: null,
        your_reading: null,
        sealed_at: r.sealed_at,
        your_reply: r.reply,
        replied_at: r.replied_at,
      });
    } else if (r.reader_id === userId && r.sealed_at) {
      letters.push({
        you_were: "reader",
        with: r.asker_name,
        asked_at: r.created_at,
        blind: r.blind,
        your_question: null,
        your_letter: r.letter,
        your_reading: r.reading_line,
        sealed_at: r.sealed_at,
        your_reply: null,
        replied_at: null,
      });
    }
  }
  return { letters };
}

const day = (d: string) => new Date(d).toISOString().slice(0, 10);

export function letterExportMarkdown(data: LetterExport): string[] {
  if (data.letters.length === 0) return [];
  const out: string[] = [``, `## Letters`, ``, `Only your own words are here. What other members wrote stays with them.`];
  for (const l of data.letters) {
    if (l.you_were === "asker") {
      out.push(``, `### ${day(l.asked_at)}: you asked${l.with ? ` ${l.with}` : " your circle"}${l.blind ? " (blind)" : ""}`, ``, l.your_question ?? "");
      if (l.your_reply) out.push(``, `**You wrote back${l.replied_at ? ` on ${day(l.replied_at)}` : ""}:**`, ``, l.your_reply);
    } else {
      out.push(``, `### ${l.sealed_at ? day(l.sealed_at) : day(l.asked_at)}: your letter to ${l.with ?? "someone"}${l.blind ? " (blind)" : ""}`);
      if (l.your_reading) out.push(``, `Your reading: ${l.your_reading}`);
      out.push(``, l.your_letter ?? "");
    }
  }
  return out;
}
