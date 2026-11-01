// The safety net in front of the AI companion. Before any of a person's words are sent to a model for questions, they pass through two
// checks that do not depend on how a model feels that day:
//   1. This file's screen, in code. Plain talk of ending a life or self-harm ("explicit") gets a fixed, human-written reply and no model
//      call. Things said sideways ("concern": giving belongings away, standing at heights, feeling like a burden, "quietly stop") get a
//      fixed gentle check-in that the person can set aside.
//   2. A short risk-check call to the model (lib/companion-prompt.ts, parseRiskVerdict below) that answers YES, UNSURE, or NO. It catches
//      what the screen cannot. YES gets the crisis reply; UNSURE gets the check-in.
// The 2026-10-14 bake-off found that a model asked only to "follow the safety lines" while writing questions failed on the sideways
// cases (0 of 30 for Qwen3.5, 4 of 30 for Gemma), so the questions are only asked when both checks say to go ahead.
//
// Neither check catches everything. The app must keep saying plainly that the companion is not crisis support. The screen errs toward
// catching: a gentle reply to someone who did not need it costs little. DRAFT wording: the owner should read and edit the replies, and
// the numbers and website should be checked now and then.

export type CrisisLanguage = "en" | "es";
export type SafetyLevel = "explicit" | "concern";

interface Pattern {
  id: string;
  language: CrisisLanguage | "other";
  re: RegExp;
  /** Words that, when present anywhere in the text, show the phrase is something ordinary (clearing out a flat, for example). */
  unless?: RegExp;
}

// Matched against lower-case text with accents removed and curly apostrophes made straight.
const EXPLICIT: Pattern[] = [
  { id: "kill-myself", language: "en", re: /\bkill(ing|ed)? my ?self\b/ },
  { id: "end-my-life", language: "en", re: /\bend(ing)? (my|my own) life\b|\bend it all\b|\btak(e|ing) my own life\b|\btake my life\b/ },
  { id: "suicide", language: "en", re: /\bsuicid(e|al)\b/ },
  { id: "want-to-die", language: "en", re: /\b(want|wanna|wish|wished|wishing|need) to (die|be dead|not exist|not be alive)\b|\bwanna die\b|\bwish(ed|ing)? (i|that i) (was|were) dead\b|\bbetter off dead\b|\brather be dead\b|\b(wish|wished|wishing|want|wanna) (i could |to )(just )?disappear(?= *($|[.,!?;]|forever|for good|completely))/ },
  { id: "dont-want-to-be-here", language: "en", re: /\b(don't|do not|dont) want to (be here|be alive|live|go on|wake up)\b|\bno reason to (live|go on)\b|\bnot worth living\b|\blife isn't worth\b|\b(can't|cannot) go on\b/ },
  { id: "wont-wake-up", language: "en", re: /\b(hope|hoping|wish|wishing) (i|that i) (just )?(won't|will not|wouldn't|would not) wake up\b/ },
  { id: "no-point-living", language: "en", re: /\bno point (in|to) (living|going on|being alive|anything)\b|\bgive up on (life|living)\b/ },
  { id: "hurt-myself", language: "en", re: /\b(hurt|harm|injur(e|ing)|cutting|cut) my ?self\b|\bself[- ]?harm/ },
  { id: "better-without-me", language: "en", re: /\b(better|fine|happier|safer) (off )?without me\b|\b(no ?one|nobody) (would|will|'d) (miss|notice|care)( me| if i)\b/ },
  { id: "es-morir", language: "es", re: /\bquiero (morir|morirme|desaparecer)\b|\bme quiero morir\b|\bmatarme\b|\bsuicid|\bquitarme la vida\b|\bacabar con mi vida\b|\bno quiero (vivir|seguir viviendo|estar aqui)\b|\bhacerme dano\b|\bmejor sin mi\b/ },
  { id: "fr-de-other", language: "other", re: /\bme suicider\b|\bme tuer\b|\bje veux mourir\b|\bmich umbringen\b|\bsuizid\b|\bich will sterben\b|\bich will nicht mehr leben\b/ },
];

// Things said sideways. Each is a reason to pause and ask plainly, not proof of anything.
const CONCERN: Pattern[] = [
  {
    id: "giving-things-away",
    language: "en",
    re: /\bgiv(e|ing|en) (away )?(all )?(of )?(my|the)( good| best| favou?rite)? (things|stuff|belongings|possessions|books|records|clothes|coat)( away)?\b|\bgiv(e|ing) away (all )?(my|everything|most of my)\b/,
    unless: /\b(charity|donat|declutter|spring[- ]?clean|thrift|car boot|yard sale|garage sale|marie kondo|konmari|moving|downsiz|clearing out|clear out)/,
  },
  {
    id: "high-place",
    language: "en",
    re: /\b(bridge|overpass|viaduct|roof|rooftop|ledge|cliff|balcony|tower)\b[^]*\b(look(ing)? down|stand(ing)? (on|at|near) the edge|sit(ting)? on the edge|on the edge|think(ing)? about jumping|could jump|jump(ing)? off|just stand there)\b|\b(look(ing)? down|stand(ing)? (on|at|near) the edge|think(ing)? about jumping|could jump|jump(ing)? off|just stand there)\b[^]*\b(bridge|overpass|viaduct|roof|rooftop|ledge|cliff|balcony|tower)\b/,
  },
  { id: "quietly-stop", language: "en", re: /\bquietly (stop|disappear|vanish|slip away)\b|\bstop existing\b|\bvanish forever\b/ },
  { id: "burden", language: "en", re: /\b(i'?m|i am|being) (just )?(a|such a) burden\b|\bburden (to|on) (everyone|everybody|my family|them|the people)\b|\beveryone would have an easier time\b/ },
  {
    id: "when-im-gone",
    language: "en",
    re: /\b(when|after|once) i'?m gone(?! (on|to|for|away|from|abroad|travelling|traveling|by))\b|\bsay(ing)? goodbye to everyone\b|\bput(ting)? my affairs in order\b|\b(goodbye|farewell) letters?\b|\bmy last (letter|note|message)\b/,
  },
  {
    id: "tired-of-living",
    language: "en",
    re: /\b(tired|sick) of (being alive|living|life)\b|\bnothing matters anymore\b|\bwhat'?s the point of (any(thing)?|it all|living)\b|\b(don't|do not|dont) (really )?see the point (of|in) (any of it|anything|living|going on|all of it)\b/,
  },
];

export function normaliseForScreen(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[‘’ʼ]/g, "'")
    .replace(/\s+/g, " ");
}

export interface CrisisScreen {
  caught: boolean;
  /** "explicit": plain talk of ending a life or self-harm. "concern": said sideways. */
  level?: SafetyLevel;
  /** Which rule matched (never the person's words), for logs and tests. */
  rule?: string;
  language?: CrisisLanguage;
}

/** Screens the text that would be sent to the companion. Pure. Explicit phrases are checked before sideways ones. */
export function screenForCrisis(text: string): CrisisScreen {
  const t = normaliseForScreen(text);
  for (const p of EXPLICIT) {
    if (p.re.test(t)) return { caught: true, level: "explicit", rule: p.id, language: p.language === "es" ? "es" : "en" };
  }
  for (const p of CONCERN) {
    if (p.re.test(t) && !(p.unless && p.unless.test(t))) return { caught: true, level: "concern", rule: p.id, language: "en" };
  }
  return { caught: false };
}

/**
 * The short phrases in a text that the screen finds worrying (normalised, as the screen sees them). Used after the model has written
 * questions: a line that repeats one of them is removed, because a model told "do not repeat those words" often does anyway.
 * Matches that run longer than 60 characters are left out; a line holding such a pair is still caught by `screenForCrisis` on the line.
 */
export function worryPhrases(text: string): string[] {
  const t = normaliseForScreen(text);
  const found = new Set<string>();
  for (const p of [...EXPLICIT, ...CONCERN]) {
    if (p.unless && p.unless.test(t)) continue;
    const m = p.re.exec(t);
    if (m && m[0].trim().length >= 4 && m[0].length <= 60) found.add(m[0].trim());
  }
  return [...found];
}

/** Whether a line of the companion's reply repeats worrying words from the person's entry, or would itself trip the screen. */
export function lineRepeatsWorry(line: string, phrases: string[]): boolean {
  const l = normaliseForScreen(line);
  return screenForCrisis(line).caught || phrases.some((p) => l.includes(p));
}

// --- The model's own risk check ---

export type RiskVerdict = "yes" | "unsure" | "no";

/** Reads the one-word answer of the risk-check call. Anything that is not clearly YES or NO counts as UNSURE: when in doubt, pause. */
export function parseRiskVerdict(reply: string): RiskVerdict {
  const cleaned = reply.replace(/<think>[\s\S]*?<\/think>/gi, "").replace(/^[\s\S]*<\/think>/i, "").trim();
  const word = (cleaned.match(/[A-Za-z]+/)?.[0] ?? "").toUpperCase();
  if (word === "YES") return "yes";
  if (word === "NO") return "no";
  return "unsure";
}

export type SafetyAction = "crisis" | "checkin" | "proceed";

export interface SafetyDecision {
  action: SafetyAction;
  /** Which check decided: a rule id, "risk-check", or nothing when the questions may be asked. */
  because?: string;
  language: CrisisLanguage;
}

/**
 * Combines the screen and the risk check. `verdict` is null when the risk check has not run (or could not): then only the screen decides,
 * so a caller must run the risk check before it asks any question.
 */
export function decideSafety(text: string, verdict: RiskVerdict | null): SafetyDecision {
  const screen = screenForCrisis(text);
  const language = screen.language ?? "en";
  if (screen.level === "explicit") return { action: "crisis", because: screen.rule, language };
  if (verdict === "yes") return { action: "crisis", because: "risk-check", language };
  if (screen.level === "concern") return { action: "checkin", because: screen.rule, language };
  if (verdict === "unsure") return { action: "checkin", because: "risk-check", language };
  return { action: "proceed", language };
}

// --- The fixed replies (DRAFT: the owner's to edit) ---

export const CRISIS_REPLY: Record<CrisisLanguage, string> = {
  en: [
    "I'm an AI, so I can't know what you're going through, and I'm not going to ask you questions about this reading right now. What you wrote sounds heavy, and it matters more than any card.",
    "",
    "If you might hurt yourself, or you don't feel safe, please reach out to someone now: a person you trust, a crisis line, or the emergency number where you are. In the US or Canada you can call or text 988. In the UK and Ireland, Samaritans are on 116 123. Anywhere else, findahelpline.com lists lines by country.",
    "",
    "Are you safe right now? You don't have to answer here. Whatever you decide, your writing stays yours.",
  ].join("\n"),
  es: [
    "Soy una IA, así que no puedo saber lo que estás viviendo, y ahora no voy a hacerte preguntas sobre esta lectura. Lo que escribiste suena muy pesado, y importa más que cualquier carta.",
    "",
    "Si crees que podrías hacerte daño o no te sientes a salvo, por favor busca ayuda ahora mismo: una persona de confianza, una línea de ayuda o el número de emergencias de tu país. En findahelpline.com hay líneas de ayuda de cada país.",
    "",
    "¿Estás a salvo en este momento? No tienes que contestar aquí. Pase lo que pase, lo que escribes sigue siendo tuyo.",
  ].join("\n"),
};

/**
 * Shown when the person carried on past a check-in and the companion could not write questions that leave the worrying words alone.
 * It asks nothing, and the box for their own writing stays theirs.
 */
export const GENTLE_FALLBACK: Record<CrisisLanguage, string> = {
  en: "Thank you for writing this down. I don't have questions I feel right asking about it today. If you'd like to keep writing, the box below is yours, and a person you trust is worth reaching too.",
  es: "Gracias por escribir esto. Hoy no tengo preguntas que me parezca bien hacer sobre ello. Si quieres seguir escribiendo, el espacio de abajo es tuyo, y vale la pena hablar también con una persona de confianza.",
};

/** A gentler pause, for things said sideways. The person can set it aside and carry on with the questions. */
export const CHECKIN_REPLY: Record<CrisisLanguage, string> = {
  en: [
    "Something in what you wrote made me want to pause before asking anything about the reading. I'm an AI, so I can't tell how you're really doing, and I'd rather ask plainly: are you having thoughts of hurting yourself or ending your life?",
    "",
    "If you are, or you're not sure, please reach out to someone now: a person you trust, a crisis line, or the emergency number where you are. In the US or Canada you can call or text 988. In the UK and Ireland, Samaritans are on 116 123. Anywhere else, findahelpline.com lists lines by country.",
    "",
    "If I've read this wrong, I'm sorry. You can carry on with the questions if you'd like.",
  ].join("\n"),
  es: [
    "Algo de lo que escribiste me hizo querer hacer una pausa antes de preguntar nada sobre la lectura. Soy una IA, así que no puedo saber cómo estás de verdad, y prefiero preguntarlo con claridad: ¿tienes pensamientos de hacerte daño o de quitarte la vida?",
    "",
    "Si es así, o no estás segura o seguro, por favor busca ayuda ahora mismo: una persona de confianza, una línea de ayuda o el número de emergencias de tu país. En findahelpline.com hay líneas de ayuda de cada país.",
    "",
    "Si lo he entendido mal, lo siento. Si quieres, podemos seguir con las preguntas.",
  ].join("\n"),
};
