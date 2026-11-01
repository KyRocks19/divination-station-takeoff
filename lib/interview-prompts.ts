// The interviewer for every reading that is not tarot (open item C6): the words it is told. Pure, so they can be tested. This file must not import
// the tarot deck, the stock meaning files, the common meanings or the archetype texts (tests/interview-prompts.test.ts checks it): what Claude
// is given about a rune, a stone, a swing of the pendulum or a throw of the dice is only what the person wrote (lib/companion-context*.ts builds
// that text, each line labelled as theirs). The tarot interviewer in app/api/interview keeps its own prompts.

import { DIVINATION_KIND_LABELS, type DivinationKind } from "./divination-kinds";

/** The author the interviewer's saved result carries in `journals` (the tarot interview uses the same word). Never counted as the person's own writing. */
export const INTERVIEW_AUTHOR = "interview";

/** The most questions and answers the interpret phase accepts, and their total size: the same limits as the tarot interview. */
export const MAX_QA = 8;
export const MAX_QA_CHARS = 16000;

export interface QA {
  question: string;
  answer: string;
}

/** The kinds this interviewer covers: every kind with its own record in `divinations` except tarot, which has its own page and prompts. */
export function isOtherKind(kind: unknown): kind is Exclude<DivinationKind, "tarot"> {
  return typeof kind === "string" && kind !== "tarot" && kind in DIVINATION_KIND_LABELS;
}

const WHAT_IT_IS = (kind: Exclude<DivinationKind, "tarot">) => `The seeker has just used ${DIVINATION_KIND_LABELS[kind]} (a divination practice they use for reflection).`;

const OWN_WORDS_RULES = `The notes you are given are written to the seeker ("you" is the seeker) and hold only what the seeker wrote, with the dates they wrote it. Treat every meaning in them as the seeker's own. Do not say what any symbol, shape, number or result traditionally means, and do not supply a meaning the seeker has not written: where they have written nothing about something, ask what it means to them. Mirror the seeker's language. Never say or imply that a meaning is wrong or that they missed something. Do not predict anything.`;

/** The system prompt for the first phase: a few open questions, returned as a JSON array. */
export function questionsSystem(kind: Exclude<DivinationKind, "tarot">): string {
  return `You are Hiero, an interviewer. ${WHAT_IT_IS(kind)} Before anything else, you want to understand the seeker's relationship to this reading. Ask 2 to 4 focused, open-ended questions that help the seeker connect what came up with their actual life and experience. The questions must come from what is in the notes: the question they asked, what came up, and the words they have written. Where they have written their own meaning for something, ask from inside that meaning. Return ONLY a valid JSON array of question strings, with no explanation and no markdown.

${OWN_WORDS_RULES}`;
}

export function questionsUser(notes: string): string {
  return `${notes}\n\nWrite 2 to 4 interview questions for this seeker. Return only a JSON array of strings.`;
}

/** The system prompt for the second phase, which the seeker asks for by pressing "Read in context". */
export function interpretSystem(kind: Exclude<DivinationKind, "tarot">): string {
  return `You are Hiero. ${WHAT_IT_IS(kind)} You have just interviewed the seeker and they have asked for a reading. Offer a short one that weaves together what came up and what the seeker told you, in their own words and meanings. Build it only from the notes and the seeker's answers. If they have given no meaning for something, say what you notice in their words and ask about it instead of supplying one. End with one open question that hands the reading back to them. No preamble. No closing pleasantries.

${OWN_WORDS_RULES}`;
}

export function interpretUser(notes: string, qa: QA[]): string {
  const qaText = qa.map((item, i) => `Q${i + 1}: ${item.question}\nA: ${item.answer}`).join("\n\n");
  return `${notes}\n\nInterview with the seeker:\n${qaText}\n\nOffer your reading in light of what the seeker shared.`;
}

/** What is saved after the interpret phase: the questions and answers, a rule, then the reading. Same shape as the tarot interview's. */
export function savedInterview(qa: QA[], reading: string): string {
  const qaFormatted = qa.map((item) => `**${item.question}**\n${item.answer}`).join("\n\n");
  return `${qaFormatted}\n\n---\n\n${reading}`;
}

/** The questions in Claude's reply: the first JSON array of strings in it, or null. At most four, each cut to a sensible length. */
export function parseQuestions(text: string): string[] | null {
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return null;
  try {
    const list: unknown = JSON.parse(match[0]);
    if (!Array.isArray(list)) return null;
    const questions = list.filter((q): q is string => typeof q === "string" && q.trim().length > 0).map((q) => q.trim().slice(0, 400)).slice(0, 4);
    return questions.length > 0 ? questions : null;
  } catch {
    return null;
  }
}

/** The questions and answers from a request: a short list of {question, answer} strings within the size limit, or null. */
export function cleanQa(value: unknown): QA[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_QA || JSON.stringify(value).length > MAX_QA_CHARS) return null;
  const out: QA[] = [];
  for (const item of value) {
    const q = (item as { question?: unknown })?.question;
    const a = (item as { answer?: unknown })?.answer;
    if (typeof q !== "string" || typeof a !== "string") return null;
    out.push({ question: q, answer: a });
  }
  return out;
}
