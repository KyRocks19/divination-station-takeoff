import { listCardPulls, loadCard, loadPull } from "./oracle";
import { listEntries } from "./divinations";
import { formWords } from "./oracle-forms";
import { ownLinksFor, type ContextOwnLink } from "./companion-own";
import { sensedFirstFor } from "./companion-guess";

// What the AI companion is told about a reading or an item: only words the person wrote, each labelled as theirs, with dates. This file (and
// lib/companion-context-tools.ts, which builds the same text for the other tools) must never import the tarot deck, the stock meaning
// files, the common meanings, or the archetype texts (tests/companion-context.test.ts checks it), so no meaning the person did not write
// can reach the model. The same text is what "Show what would be sent" prints.

/** The most characters sent in one request. The newest writing is kept; the preview says when something was left out. */
export const MAX_CONTEXT_CHARS = 6000;

export interface ContextEntry {
  /** YYYY-MM-DD */
  when: string;
  kind: "note" | "impression" | "lookback";
  thinkingMind: boolean;
  content: string;
}

export interface ContextEarlierPull {
  when: string;
  question: string | null;
  reversed: boolean;
  entries: ContextEntry[];
}

export interface ContextEarlierMeaning {
  /** When the person wrote it, YYYY-MM-DD. */
  when: string;
  label: string | null;
  content: string;
  upsideDown: boolean;
}

export interface ContextItem {
  name: string;
  reversed: boolean;
  /** The layout position it landed in, and the person's question for it. */
  position: string | null;
  positionPrompt: string | null;
  origin: string | null;
  fields: { name: string; value: string }[];
  /** `when` is the day the person wrote this wording, when it is known. */
  meanings: { label: string | null; content: string; upsideDown: boolean; when?: string }[];
  /** Wordings of the meaning the person has since replaced. Only sent when asking what has changed. */
  earlierMeanings: ContextEarlierMeaning[];
  earlier: ContextEarlierPull[];
  /** The person's own archetypes and concepts they linked this to, with what they wrote about them. Never the app's own archetypes. */
  ownLinks?: ContextOwnLink[];
}

export interface ContextInput {
  /** "card", "stone", "rune", and so on: the word for what the set is made of. */
  noun: string;
  when: string;
  question: string | null;
  layoutName: string | null;
  /** Extra plain lines under the heading (for example, which surface a person looked into). */
  extra?: string[];
  items: ContextItem[];
  entries: ContextEntry[];
  /** What the person sensed first, only when they ticked that the companion may read it on this reading (lib/companion-guess.ts). */
  sensedFirst?: { when: string; text: string } | null;
}

export interface CompanionContext {
  text: string;
  /** True when some of the person's writing was left out to stay within the limit. */
  truncated: boolean;
  /** Whether there is anything earlier to set beside today's words: earlier readings of the same item, or earlier wordings of a meaning. */
  hasHistory: boolean;
  /** The person's own words in the order they wrote them, built in code with no model (see formatTimeline). Only when asked for with `history`. */
  timeline?: string;
}

const ENTRY_LABEL: Record<ContextEntry["kind"], string> = {
  note: "You wrote",
  impression: "You wrote, as what you noticed first",
  lookback: "You wrote, looking back",
};

function entryLines(e: ContextEntry): string {
  const mark = e.thinkingMind ? " (you marked this as your thinking mind rather than what you sensed)" : "";
  return `${ENTRY_LABEL[e.kind]} on ${e.when}${mark}: ${e.content.trim()}`;
}

function itemBlock(it: ContextItem, noun: string): string {
  const lines = [`The ${noun} that came up: ${it.name}${it.reversed ? " (upside down)" : ""}`];
  if (it.position) lines.push(`Where it landed: ${it.position}${it.positionPrompt ? `. You asked of this place: ${it.positionPrompt}` : ""}`);
  if (it.origin) lines.push(`You wrote that it comes from: ${it.origin.trim()}`);
  for (const f of it.fields) if (f.value.trim()) lines.push(`You wrote under "${f.name}": ${f.value.trim()}`);
  for (const m of it.meanings) {
    lines.push(`You wrote${m.label ? ` (${m.label})` : ""} as its meaning${m.upsideDown ? " when upside down" : ""}: ${m.content.trim()}`);
  }
  for (const l of it.ownLinks ?? []) {
    const side = l.side === "light" ? ", on the side that goes well" : l.side === "shadow" ? ", on the hard side" : "";
    lines.push(`You linked it to your own ${l.kind === "archetype" ? "archetype" : "concept"}, "${l.name}"${side}`);
    if (l.words.length) lines.push(`You wrote about "${l.name}": ${l.words.join("; ")}`);
  }
  return lines.join("\n");
}

function earlierBlock(it: ContextItem, p: ContextEarlierPull): string {
  const head = `An earlier time ${it.name} came up, on ${p.when}${p.reversed ? " (upside down)" : ""}${p.question ? `. Your question then: ${p.question.trim()}` : ""}`;
  return [head, ...p.entries.map(entryLines)].join("\n");
}

function earlierMeaningBlock(it: ContextItem, m: ContextEarlierMeaning): string {
  return `On ${m.when} you wrote${m.label ? ` (${m.label})` : ""} as the meaning of ${it.name}${m.upsideDown ? " when upside down" : ""}: ${m.content.trim()}`;
}

/**
 * Turns what the person wrote into the text sent to the companion. Pure: the same input gives the same text. The question, the items,
 * and what they wrote about this reading are always kept as far as they fit (the oldest entries go first); earlier readings and, when
 * `history` is true, earlier wordings of a meaning are added newest first while there is room.
 */
export function formatContext(input: ContextInput, limit = MAX_CONTEXT_CHARS, opts: { history?: boolean } = {}): CompanionContext {
  const head: string[] = [`Your ${input.noun} reading of ${input.when}.`];
  if (input.question?.trim()) head.push(`Your question: ${input.question.trim()}`);
  if (input.layoutName) head.push(`Your layout: ${input.layoutName}`);
  head.push(...(input.extra ?? []));
  if (input.sensedFirst) head.push(`What you sensed first, written and sealed on ${input.sensedFirst.when} before you opened any meaning: ${input.sensedFirst.text.trim()}`);
  const items = input.items.map((it) => itemBlock(it, input.noun));
  const base = [head.join("\n"), ...items].join("\n\n");

  let truncated = false;
  let entries = input.entries.map(entryLines);
  const withEntries = () => (entries.length ? `\n\nWhat you wrote about this reading:\n${entries.join("\n")}` : "");
  while (entries.length > 0 && base.length + withEntries().length > limit) {
    entries = entries.slice(1);
    truncated = true;
  }
  let text = base + withEntries();
  if (text.length > limit) {
    text = text.slice(0, limit - 1) + "…";
    truncated = true;
  }

  const earlier = [
    ...input.items.flatMap((it) => it.earlier.map((p) => ({ when: p.when, block: earlierBlock(it, p) }))),
    ...(opts.history ? input.items.flatMap((it) => it.earlierMeanings.map((m) => ({ when: m.when, block: earlierMeaningBlock(it, m) }))) : []),
  ].sort((a, b) => (a.when < b.when ? 1 : a.when > b.when ? -1 : 0));
  for (const e of earlier) {
    const next = `${text}\n\n${e.block}`;
    if (next.length > limit) {
      truncated = true;
      continue;
    }
    text = next;
  }
  const hasHistory = input.items.some((it) => it.earlier.length > 0 || it.earlierMeanings.length > 0);
  return { text, truncated, hasHistory, ...(opts.history && hasHistory ? { timeline: formatTimeline(input) } : {}) };
}

/** The most characters a timeline may have (a kept answer holds 6,000). The oldest lines go first. */
const MAX_TIMELINE_CHARS = 5600;

/**
 * "What has changed", with no model: the person's own words for each item, from earliest to latest, each line starting with the day they wrote
 * it. It is built from their exact words and dates, so nothing can be misquoted or misdated, and it says nothing about what a change means.
 */
export function formatTimeline(input: ContextInput): string {
  const blocks: string[] = [];
  for (const it of input.items) {
    const events: { when: string; order: number; text: string }[] = [];
    const wording = (label: string | null, content: string, upsideDown: boolean) =>
      `You wrote${label ? ` (${label})` : ""} as its meaning${upsideDown ? " when upside down" : ""}: ${content.trim()}`;
    for (const m of it.earlierMeanings) events.push({ when: m.when, order: 0, text: wording(m.label, m.content, m.upsideDown) });
    for (const m of it.meanings) if (m.when) events.push({ when: m.when, order: 0, text: wording(m.label, m.content, m.upsideDown) });
    const came = (when: string, reversed: boolean, question: string | null) =>
      ({ when, order: 1, text: `${it.name} came up${reversed ? " (upside down)" : ""}${question?.trim() ? `. You asked: ${question.trim()}` : "."}` });
    for (const p of it.earlier) {
      events.push(came(p.when, p.reversed, p.question));
      for (const e of p.entries) events.push({ when: e.when, order: 2, text: `${ENTRY_LABEL[e.kind]}: ${e.content.trim()}` });
    }
    events.push(came(input.when, it.reversed, input.question));
    events.sort((a, b) => (a.when < b.when ? -1 : a.when > b.when ? 1 : a.order - b.order));
    blocks.push([it.name, ...events.map((e) => `${e.when}  ${e.text}`)].join(String.fromCharCode(10)));
  }
  const nl = String.fromCharCode(10);
  const thisReading = input.entries.map((e) => `${e.when}  ${ENTRY_LABEL[e.kind]}: ${e.content.trim()}`);
  if (thisReading.length) blocks.push([`This reading (${input.when})`, ...thisReading].join(nl));
  const intro = "Your own words, in the order you wrote them. Nothing here is mine.";
  const outro = "Nothing above says what changed or why. That is yours to read.";
  let body = blocks.join(nl + nl);
  let trimmed = false;
  while (body.length > MAX_TIMELINE_CHARS) {
    const lines = body.split(nl);
    const i = lines.findIndex((l) => /^\d{4}-\d{2}-\d{2}  /.test(l));
    if (i < 0) break;
    lines.splice(i, 1);
    body = lines.join(nl);
    trimmed = true;
  }
  return [intro, "", body, ...(trimmed ? ["", "(Some of your oldest lines were left out to keep this short.)"] : []), "", outro].join(nl);
}

export const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);
export function toKind(k: string): ContextEntry["kind"] {
  return k === "impression" || k === "lookback" ? k : "note";
}

/** Wordings of a meaning that were replaced by the one now current, newest first. Wordings equal to the current one are not "earlier". */
export function replacedWordings<T extends { content: string }>(current: string | null, versions: T[]): T[] {
  const now = (current ?? "").trim();
  const seen = new Set<string>([now]);
  const out: T[] = [];
  for (const v of versions) {
    const c = v.content.trim();
    if (!c || seen.has(c)) continue;
    seen.add(c);
    out.push(v);
  }
  return out;
}

/** Reads a person's own oracle pull and what they wrote about it, then formats it. Null when the pull is not theirs. */
export async function buildPullContext(userId: number, pullId: number, opts: { history?: boolean } = {}): Promise<CompanionContext | null> {
  const pull = await loadPull(userId, pullId);
  if (!pull) return null;
  const sensedFirst = await sensedFirstFor(userId, pull.id);
  const entries = await listEntries(userId, pull.id);
  const own = await ownLinksFor(userId, [], pull.cards.map((c) => c.card_id).filter((id): id is number => !!id));
  const items: ContextItem[] = await Promise.all(
    pull.cards.map(async (c) => {
      const card = c.card_id ? await loadCard(userId, c.card_id) : null;
      const earlier = c.card_id ? await listCardPulls(userId, c.card_id, pull.id, 3) : [];
      return {
        name: c.card_name,
        reversed: c.reversed === 1,
        position: c.position_name,
        positionPrompt: c.position_prompt,
        origin: card?.origin ?? null,
        fields: (card?.fields ?? []).filter((f) => f.value).map((f) => ({ name: f.name, value: f.value! })),
        meanings: (card?.meanings ?? []).map((m) => ({ label: m.label, content: m.content, upsideDown: m.reversed === 1, when: day(m.updated_at) })),
        earlierMeanings: (card?.meanings ?? []).flatMap((m) =>
          replacedWordings(m.content, m.earlier).map((v) => ({ when: day(v.created_at), label: m.label ?? v.label, content: v.content, upsideDown: m.reversed === 1 }))
        ),
        earlier: earlier.map((p) => ({
          when: day(p.created_at),
          question: p.question,
          reversed: p.reversed === 1,
          entries: p.entries.map((e) => ({ when: day(e.created_at), kind: toKind(e.kind), thinkingMind: false, content: e.content })),
        })),
        ownLinks: c.card_id ? own.byOracleCard.get(c.card_id) ?? [] : [],
      };
    })
  );
  return formatContext(
    {
      noun: formWords(pull.deck_form).one,
      when: day(pull.created_at),
      question: pull.question,
      layoutName: pull.layout_name,
      items,
      sensedFirst,
      entries: entries.map((e) => ({ when: day(e.created_at), kind: toKind(e.kind), thinkingMind: e.thinking_mind === 1, content: e.content })),
    },
    MAX_CONTEXT_CHARS,
    opts
  );
}

/**
 * One oracle item on its own (for picture ideas): its name and everything the person wrote about it. Null when it is not theirs.
 * `hasHistory` is always false: this is not a reading.
 */
export async function buildItemContext(userId: number, cardId: number): Promise<CompanionContext | null> {
  const card = await loadCard(userId, cardId);
  if (!card) return null;
  const own = await ownLinksFor(userId, [], [cardId]);
  const item: ContextItem = {
    name: card.name,
    reversed: false,
    position: null,
    positionPrompt: null,
    origin: card.origin,
    fields: card.fields.filter((f) => f.value).map((f) => ({ name: f.name, value: f.value! })),
    meanings: card.meanings.map((m) => ({ label: m.label, content: m.content, upsideDown: m.reversed === 1 })),
    earlierMeanings: [],
    earlier: [],
    ownLinks: own.byOracleCard.get(cardId) ?? [],
  };
  const noun = formWords(card.deck_form).one;
  const text = [`Your ${noun}: ${card.name}`, itemBlock(item, noun).split("\n").slice(1).join("\n")].filter(Boolean).join("\n");
  const limited = text.length > MAX_CONTEXT_CHARS ? text.slice(0, MAX_CONTEXT_CHARS - 1) + "…" : text;
  return { text: limited, truncated: text.length > MAX_CONTEXT_CHARS, hasHistory: false };
}
