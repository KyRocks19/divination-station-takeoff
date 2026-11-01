// The signs and dreams log: a note of something the person noticed in daily life, or dreamed. It is a log and not a method: the app picks nothing and gives no
// meaning to any sign or dream. The note sits beside the person's readings, with the same journals, predictions and look-backs, so what followed can be
// written next to what was noticed. This file touches no database code, so screens that run in the browser can import it.

export type NoteType = "sign" | "dream";
export const NOTE_TYPES: NoteType[] = ["sign", "dream"];
export const MAX_NOTE_CHARS = 5000;

export const NOTE_WORDS: Record<NoteType, { label: string; plural: string; prompt: string }> = {
  sign: { label: "A sign", plural: "Signs", prompt: "What did you notice, and where were you?" },
  dream: { label: "A dream", plural: "Dreams", prompt: "What do you remember of the dream?" },
};

export function isNoteType(v: unknown): v is NoteType {
  return v === "sign" || v === "dream";
}

/** The note's text trimmed, or null when it is empty or longer than MAX_NOTE_CHARS. */
export function cleanNoteBody(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length > 0 && t.length <= MAX_NOTE_CHARS ? t : null;
}

/** A day as 'YYYY-MM-DD' that is a real date, or null (also for text that is not a date). Empty text means "no day given". */
export function cleanDay(v: unknown): string | null | undefined {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v.trim())) return undefined;
  const d = new Date(`${v.trim()}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== v.trim() ? undefined : v.trim();
}

/** A short line naming a note, for lists and the reading's summary. */
export function noteSummary(type: NoteType, body: string): string {
  const flat = body.replace(/\s+/g, " ").trim();
  return `${NOTE_WORDS[type].label}: ${flat.length > 80 ? `${flat.slice(0, 79)}…` : flat}`;
}

export const SIGN_WORDS = {
  here: "Write down a sign you noticed or a dream you had. The app gives no meaning to either. Afterwards you can add entries and predictions to a note, and see it beside your readings, so you can look back at what followed.",
};
