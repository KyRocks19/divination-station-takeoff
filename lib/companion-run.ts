import { COMPANION_SETTINGS } from "./companion-config";
import { RISK_CHECK_SYSTEM, askMessage, companionSystemPrompt, riskCheckMessage } from "./companion-prompt";
import type { ModelMode } from "./companion-modes";
import { checkReply, countQuestions, dropLines, tidyReply } from "./companion-reply";
import { CHECKIN_REPLY, CRISIS_REPLY, GENTLE_FALLBACK, decideSafety, lineRepeatsWorry, parseRiskVerdict, worryPhrases, type CrisisLanguage } from "./companion-safety";

// What happens when a person asks the companion for questions, from their words to what they are shown. Pure apart from the `ask` function it is
// given, so every path is tested with a fake model (tests/companion-run.test.ts). Order matters and is the point:
//   1. the code screen, which may answer alone (crisis) or ask to pause (check-in);
//   2. the risk check, one short call to the model, before any question is asked;
//   3. only if both say go ahead, the questions.

export type ChatMessage = { role: "system" | "user"; content: string };
export type AskModel = (messages: ChatMessage[], opts: { maxTokens: number; temperature: number }) => Promise<string>;

/** "questions" is the companion's questions; "reply" is any other kind of answer it was asked for (what has changed, a reading, picture ideas). */
export type CompanionAction = "questions" | "reply" | "crisis" | "checkin" | "gentle";

export interface CompanionOutcome {
  action: CompanionAction;
  /** What the person is shown. */
  text: string;
  /** Which check decided a pause, for logs: a rule id or "risk-check". Never the person's words. */
  because?: string;
  /** Whether the check-in lets the person carry on. A crisis reply does not. */
  canContinue: boolean;
}

const crisis = (language: CrisisLanguage, because?: string): CompanionOutcome => ({ action: "crisis", text: CRISIS_REPLY[language], because, canContinue: false });
const checkin = (language: CrisisLanguage, because?: string): CompanionOutcome => ({ action: "checkin", text: CHECKIN_REPLY[language], because, canContinue: true });

/** The part that needs no model: the code screen alone. Null means the screen has no objection. */
export function screenOutcome(context: string, acknowledged: boolean): CompanionOutcome | null {
  const d = decideSafety(context, null);
  if (d.action === "crisis") return crisis(d.language, d.because);
  if (d.action === "checkin" && !acknowledged) return checkin(d.language, d.because);
  return null;
}

export async function runCompanion(opts: { context: string; name: string; acknowledged: boolean; ask: AskModel; mode?: ModelMode; focus?: string }): Promise<CompanionOutcome> {
  const { context, name, acknowledged, ask } = opts;
  const mode = opts.mode ?? "questions";
  // A suggested line for the person's note is made from counts the app made in code, with none of the person's words, so there is nothing for the
  // crisis screen or the risk check to read: they are skipped, and nothing else about the path changes.
  const countsOnly = mode === "noticed";
  const first = countsOnly ? null : screenOutcome(context, acknowledged);
  if (first) return first;

  const verdict = countsOnly ? ("no" as const) : parseRiskVerdict(
    await ask(
      [
        { role: "system", content: RISK_CHECK_SYSTEM },
        { role: "user", content: riskCheckMessage(context) },
      ],
      { maxTokens: COMPANION_SETTINGS.riskCheckMaxTokens, temperature: COMPANION_SETTINGS.riskCheckTemperature }
    )
  );
  const d = decideSafety(context, verdict);
  if (d.action === "crisis") return crisis(d.language, d.because);
  // A person who has already seen the check-in and chose to carry on is not asked again; a YES above still stops everything.
  if (d.action === "checkin" && !acknowledged) return checkin(d.language, d.because);

  // Whatever the model is told, it may still repeat the person's worrying words back. Lines that do are removed here, in code; if too few
  // questions are left the model is asked again, and after MAX_TRIES the person gets a fixed gentle note instead of questions.
  const phrases = worryPhrases(context);
  for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
    const raw = await ask(
      [
        { role: "system", content: companionSystemPrompt(name, acknowledged, mode, opts.focus ?? "") },
        { role: "user", content: askMessage(context, mode) },
      ],
      { maxTokens: COMPANION_SETTINGS.maxTokens, temperature: COMPANION_SETTINGS.temperature }
    );
    const tidy = tidyReply(raw, context);
    if (!tidy.text.trim()) throw new Error("the model sent no questions");
    const unquoted = countsOnly ? tidy.text.trim().replace(/^["“”']+|["“”']+$/g, "") : tidy.text;
    const clean = dropLines(unquoted, (line) => lineRepeatsWorry(line, phrases));
    if (usable(mode, clean.text, context)) return { action: mode === "questions" || mode === "pattern" ? "questions" : "reply", text: clean.text, canContinue: false };
  }
  // A reply that failed only because of lines removed for repeating worrying words becomes a fixed gentle note; any other failure is an honest error.
  if (phrases.length > 0) return { action: "gentle", text: GENTLE_FALLBACK[d.language], because: "no reply without the worrying words", canContinue: false };
  throw new Error(`the model could not write a usable ${mode} reply`);
}

/** How many times the model is asked for questions before the fixed gentle note is shown instead. */
export const MAX_TRIES = 3;
/** Fewest questions a reply must still have, after lines repeating worrying words are removed, to be shown. */
export const MIN_QUESTIONS = 2;

const datesIn = (t: string) => t.match(/\b\d{4}-\d{2}-\d{2}\b/g) ?? [];

/** Whether a reply is good enough to show for this mode: the shape the mode asks for, and nothing the person did not write. */
export function usable(mode: ModelMode, text: string, context: string): boolean {
  const checks = checkReply(text, context);
  if (checks.inventedDate) return false;
  switch (mode) {
    case "questions":
    case "pattern":
      return countQuestions(text) >= MIN_QUESTIONS;
    case "reading":
      return checks.words >= 20 && checks.words <= 260 && !checks.prediction && !checks.verdict;
    case "noticed": {
      // One plain line: the first person, short, with no numbers (a small model counts badly) and no verdict or prediction.
      const one = text.trim();
      return one.split(String.fromCharCode(10)).length === 1 && one.length <= 240 && checks.words >= 4 && checks.words <= 40 && !/[0-9]/.test(one) && !checks.prediction && !checks.verdict && !checks.advice && !/\b(trust|trusts|best|better|prefer|prefers|value|values|always|never|rather|important|takes over|over my|more than|than my)\b/i.test(one) && /^I[ ’']/.test(one);
    }
    case "scene": {
      const ideas = text.split(String.fromCharCode(10)).filter((l) => /^\s*\d+[.)]\s/.test(l) && l.replace(/^\s*\d+[.)]\s*/, "").split(/\s+/).length >= 4);
      return ideas.length >= 2;
    }
  }
}
