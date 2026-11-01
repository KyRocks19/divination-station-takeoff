// One reading as Markdown text for the person to copy and post anywhere (a forum, a message, a note). Browser-safe and pure: no database,
// no network. The text is built in the person's own browser from the reading already on the page, and only the parts they tick are in it.
// This is not the Settings export, which is the whole account.

export interface ShareCard {
  position: string;
  card_name: string;
  reversed: boolean;
  /** Only the picture of a spread uses these (lib/spread-picture-core.ts); the text version ignores them. */
  card_id?: string;
  color?: string | null;
  x?: number | null;
  y?: number | null;
  rotation?: number | null;
}

export interface ShareEntry {
  id: number;
  /** The words as the app shows them: "You", "Hiero", "Your Guide"... */
  label: string;
  content: string;
}

export interface ShareReading {
  title: string | null;
  spread_name: string;
  question: string;
  created_at: string;
  notes: string;
  cards: ShareCard[];
  /** Cards drawn to clarify, by the index of the card they clarify. */
  clarifiers: Record<number, ShareCard[]>;
}

/** What the person chose to include. Everything but the cards is off until they tick it. */
export interface ShareChoices {
  question: boolean;
  date: boolean;
  notes: boolean;
  /** The ids of the journal entries they ticked. */
  entryIds: number[];
}

export const NOTHING_EXTRA: ShareChoices = { question: false, date: false, notes: false, entryIds: [] };

const orient = (c: ShareCard) => (c.reversed ? "reversed" : "upright");

/** A line of the person's own text, kept on one line so it cannot start a new Markdown block by accident. */
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

/** Where a longer piece of the person's writing sits inside the post: shifted down so its own headings never outrank the post's. */
const indentHeadings = (s: string) => s.replace(/^(#{1,5})(\s)/gm, "#$1$2");

const dateLine = (iso: string, locale?: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale ?? "en-US", { year: "numeric", month: "long", day: "numeric" });
};

/** The reading as Markdown. Pure: the same reading and choices always give the same text. */
export function readingToMarkdown(r: ShareReading, entries: ShareEntry[], c: ShareChoices, locale?: string): string {
  const title = oneLine(r.title || "") || oneLine(r.spread_name) || "Reading";
  const out: string[] = [`# ${title}`];
  const meta: string[] = [];
  if (oneLine(r.spread_name) && oneLine(r.spread_name) !== title) meta.push(oneLine(r.spread_name));
  if (c.date) {
    const d = dateLine(r.created_at, locale);
    if (d) meta.push(d);
  }
  if (meta.length) out.push("", `_${meta.join(" · ")}_`);
  if (c.question && oneLine(r.question)) out.push("", `**Question:** ${oneLine(r.question)}`);

  out.push("", "## Cards", "");
  r.cards.forEach((card, i) => {
    out.push(`${i + 1}. **${oneLine(card.position) || `Card ${i + 1}`}**: ${card.card_name} (${orient(card)})`);
    for (const cl of r.clarifiers[i] ?? []) out.push(`   - clarifier: ${cl.card_name} (${orient(cl)})`);
  });

  if (c.notes && r.notes.trim()) out.push("", "## Notes", "", indentHeadings(r.notes.trim()));

  const chosen = entries.filter((e) => c.entryIds.includes(e.id) && e.content.trim());
  if (chosen.length) {
    out.push("", "## Journal");
    for (const e of chosen) out.push("", `**${oneLine(e.label)}**`, "", indentHeadings(e.content.trim()));
  }
  return out.join("\n") + "\n";
}

// ── A reading with any other tool ────────────────────────────────────────────────────────────────────

export interface ShareToolReading {
  /** The tool's name as the app shows it: "Runes", "I Ching". */
  tool: string;
  question: string;
  created_at: string;
  /** What came up, one line each, already in words (the position, the name, whether it was upside down, where it was found). */
  lines: string[];
}

/** A reading with any tool but tarot as Markdown, built the same way as a tarot one: only what came up is in it unless the person ticked more. */
export function toolReadingToMarkdown(r: ShareToolReading, entries: ShareEntry[], c: ShareChoices, locale?: string): string {
  const out: string[] = [`# ${oneLine(r.tool) || "Reading"}`];
  if (c.date) {
    const d = dateLine(r.created_at, locale);
    if (d) out.push("", `_${d}_`);
  }
  if (c.question && oneLine(r.question)) out.push("", `**Question:** ${oneLine(r.question)}`);

  out.push("", "## What came up", "");
  r.lines.forEach((line, i) => out.push(`${i + 1}. ${oneLine(line)}`));

  const chosen = entries.filter((e) => c.entryIds.includes(e.id) && e.content.trim());
  if (chosen.length) {
    out.push("", "## Journal");
    for (const e of chosen) out.push("", `**${oneLine(e.label)}**`, "", indentHeadings(e.content.trim()));
  }
  return out.join("\n") + "\n";
}
