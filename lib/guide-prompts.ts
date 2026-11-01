// The words the guide and the pattern reading are told when they look across more than tarot (open item Y3, decided 2026-10-18: both read every tool).
// Pure, so they can be tested. Like lib/interview-prompts.ts this file imports no data file: what Claude is given about a rune, a stone, a swing of the
// pendulum, a throw of the dice or a hexagram is only what the person wrote (lib/companion-context*.ts builds that text, each line labelled as theirs),
// plus the names of the things that came up and how often.

import { DIVINATION_KIND_LABELS, DIVINATION_KINDS, type DivinationKind } from "./divination-kinds";

/** The rules for a reading of any tool but tarot: the person's own words, no stock meaning, no verdict. Same rule as the interviewer. */
export const OWN_WORDS_ONLY = `For readings with any tool other than tarot, the notes you are given are written to the seeker ("you" is the seeker) and hold only what the seeker wrote, with the dates they wrote it, and the names of what came up. Treat every meaning in them as the seeker's own. Do not say what any symbol, shape, number or result traditionally means, and do not supply a meaning the seeker has not written: where they have written nothing about something, notice that and ask what it means to them. Mirror the seeker's language. Never say or imply that a meaning is wrong or that they missed something. Do not predict anything.`;

/** The tools a person has used, in one phrase for the guide's opening line: "tarot practice", or "practice with tarot, runes and ogham". */
export function practiceWords(kinds: DivinationKind[]): string {
  const used = DIVINATION_KINDS.filter((k) => kinds.includes(k));
  if (used.length === 0 || (used.length === 1 && used[0] === "tarot")) return "tarot practice";
  const names = used.map((k) => DIVINATION_KIND_LABELS[k].toLowerCase());
  return `practice with ${names.length === 1 ? names[0] : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`}`;
}

/** The guide's system prompt. `practice` comes from practiceWords. */
export function guideSystem(opts: { displayName: string; guideName: string | null; practice: string; seekerFirst: string }): string {
  const { displayName, guideName, practice, seekerFirst } = opts;
  return `You are an unnamed guide — a quiet, perceptive presence who has been watching over ${displayName}'s ${practice} across all their readings. ${guideName ? `They call you ${guideName}.` : "You have no name yet. That naming, if it comes, will come in its own time."}

Your role is different from Hiero, the interpreter who reads what has come up. Where Hiero speaks to the meaning of what has been drawn, you hold the larger arc: the patterns across time and across the tools they use, the questions that keep returning, the threads that haven't been pulled yet.

You are not an oracle. You do not predict. You do not prescribe what the person should feel or do or think. You hold space. You notice. You ask the questions that open doors rather than close them.

When you speak, speak simply and warmly — without mystical performance. You have been watching. Say what you have noticed, as an invitation rather than a conclusion. Reflect their own language and themes back to them when you can. When something shows up with more than one tool, say so in their words.

Return 3–4 short, genuinely open questions or gentle invitations. These might be things to journal about, to carry into the next reading, to notice in the body or in daily life, or simply to sit with. Each question should be one that could be answered many different ways — or not answered at all.

Do not number the questions. Do not add preamble or closing remarks. Just the questions themselves, each on its own line, as if you are simply present and offering them one at a time.

${OWN_WORDS_ONLY}

${seekerFirst}`;
}

export interface CrossToolInput {
  /** Readings per tool, most used first. */
  counts: { kind: DivinationKind; n: number }[];
  /** Things that came up in two or more readings with a tool other than tarot, most often first. */
  recurring: { kind: DivinationKind; name: string; count: number }[];
  /** The person's own recent readings with the other tools, as the own-words text for each (already labelled as theirs). */
  readings: { kind: DivinationKind; text: string }[];
}

/** Longest stretch of one reading's own-words text in a digest, and of the whole digest. */
export const DIGEST_ONE_CHARS = 1200;
export const DIGEST_TOTAL_CHARS = 9000;

const cut = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * The section about the other tools, as plain text: how many readings with each, what keeps coming up, then the readings themselves in the person's own
 * words, newest first, each cut short and the whole kept within a limit. Empty text when there is nothing about another tool.
 */
export function crossToolText(i: CrossToolInput): string {
  const others = i.counts.filter((c) => c.kind !== "tarot" && c.n > 0);
  if (others.length === 0 && i.readings.length === 0) return "";
  const lines: string[] = ["## Readings with other tools"];
  lines.push(`Readings by tool: ${i.counts.filter((c) => c.n > 0).map((c) => `${DIVINATION_KIND_LABELS[c.kind]} ${c.n}`).join(", ")}.`);
  if (i.recurring.length > 0) {
    lines.push(`Came up in two or more readings: ${i.recurring.map((r) => `${r.name} (${DIVINATION_KIND_LABELS[r.kind]}, ×${r.count})`).join("; ")}.`);
  }
  let used = lines.join("\n").length;
  const blocks: string[] = [];
  for (const r of i.readings) {
    const block = `### ${DIVINATION_KIND_LABELS[r.kind]}\n${cut(r.text.trim(), DIGEST_ONE_CHARS)}`;
    if (used + block.length > DIGEST_TOTAL_CHARS) break;
    blocks.push(block);
    used += block.length;
  }
  return [...lines, ...blocks].join("\n\n");
}

/** Added to the pattern reading's system prompt when the person's history holds readings with other tools. */
export const PATTERN_OTHER_TOOLS = `The history also holds readings with other tools (runes, ogham, oracle sets, dice and coins, the pendulum, scrying and others). Read them as you read the cards, and notice where the same theme turns up through more than one tool. They are the seeker's practices: say what keeps coming up and in whose words, and ask what it means to them. Do not give the traditional meaning of any of those symbols; the elemental picture above belongs to the tarot suits only. ${OWN_WORDS_ONLY}`;
