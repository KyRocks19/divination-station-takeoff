// "Common meanings": placeholder text for every symbol in the app's tools, written in the shared language of
// lib/archetypes-data.ts. This file touches no database code, so screens that run in the browser can import it.
//
// Rules (oracle design, SKILL.md rule 1, and the user's request of 2026-10-12):
//  - These are stock words, a place to start. They sit behind a button and are never written into a person's own
//    meanings. The person's words always come first, and the person can ignore all of this.
//  - Each entry has a light side and a shadow side, because every symbol is lived both ways. The words lean gentle
//    and still say the hard part. No reading is a verdict.
//  - Each entry names archetypes, so a rune, a die face, a swing, and a tarot card that touch the same archetype can be
//    shown together.
//  - Every tool says where its meanings come from and how settled they are (COMMON_SOURCES). Age is information, not
//    rank: modern practice is as valid as old, and nothing here is presented as older than it is.

import type { Aspect } from "./archetypes-data";

export type { Aspect };

export interface CommonMeaning {
  /** A few words, for lists. */
  keywords: string;
  /** How this symbol feels when it flows. */
  light: string;
  /** How this symbol feels when it is strained or too much. */
  shadow: string;
  /** Archetype slugs (lib/archetypes-data.ts), the strongest first. */
  archetypes: string[];
}

export type ToolKey = "rune" | "ogham" | "number" | "coin" | "pendulum" | "scrying";

/**
 * Where each tool's common meanings come from, and how settled they are. Shown with the text. Age is information, not
 * rank (the user, 2026-10-12): a modern practice is as valid as an old one, and the text says which is which only so
 * a person knows what they are reading.
 */
export const COMMON_SOURCES: Record<ToolKey, string> = {
  rune:
    "The wording is written for this app. It draws on the rune poems of the 8th to 15th centuries, which describe what each rune stands for, and on modern rune practice (Ralph Blum, 1982, and later writers), which is where the divination meanings and the upside-down meanings come from. Both are used here, and authors differ.",
  ogham:
    "The wording is written for this app. It draws on the medieval tree names given to the letters and on modern ogham practice (much of it after Robert Graves, 1948), which is where the divination meanings come from. Authors differ widely.",
  number:
    "Number meanings come from the numerology tradition and from how tarot reads its number cards. Both are modern practice in their current form (the link to Pythagoras is often claimed, but is not documented). Ancient dice oracles worked differently, from tables of verses. Faces above 12 reduce to a single digit by adding their digits, as numerology does.",
  coin:
    "The Romans called heads or ships (capita aut navia) when tossing a coin, but no surviving source says what each side means. Heads for yes and tails for no is a common modern habit, and the two-sides reading below is written for this app. In the I Ching coin method, heads counts as 3 (the yang value) and tails as 2 (the yin value), though sources differ on which side is which.",
  pendulum:
    "No single key exists, and living practitioners differ: many give clockwise as yes and counter-clockwise as no, some give back and forth as yes and side to side as no, and some the reverse. Sunwise (clockwise) as the lucky direction is an old folk idea in several cultures. The usual advice is to set your own mapping first, and the Swings page is where you do that. These lines are a common starting point.",
  scrying:
    "Scrying has no standard system of symbols; practitioners of every period have made their own. These notes say what each surface has been used for and what it tends to invite, and what you see is yours to read. John Dee used an obsidian mirror and a crystal in the 16th century (now in the British Museum), and bowl or water divination (lecanomancy, hydromancy) has Mesopotamian and Greek records.",
};

function m(keywords: string, light: string, shadow: string, archetypes: string[]): CommonMeaning {
  return { keywords, light, shadow, archetypes };
}

// ---------------------------------------------------------------- Runes (Elder Futhark)
export const RUNE_MEANINGS: Record<string, CommonMeaning> = {
  "rune-fehu": m("Wealth, resources, flow",
    "Resources moving in and out of your life, abundance that is shared and so grows.",
    "Greed, hoarding, or a loss; the old poems warn that wealth can cause quarrels among kin.",
    ["wealth-prosperity", "generosity-giving", "work-craft"]),
  "rune-uruz": m("Strength, health, raw vitality",
    "Primal strength, good health, the stamina of something wild and alive.",
    "Brute force with no direction, or weakness and illness that ask for rest.",
    ["courage-strength", "energy-vitality", "healing-health"]),
  "rune-thurisaz": m("Threshold, defence, challenge",
    "A guarded gate, a necessary challenge, a thorn that keeps harm away.",
    "A thorn that pricks: conflict, a rash reaction, danger you did not see.",
    ["protection-boundaries", "struggle-resilience", "anger-conflict"]),
  "rune-ansuz": m("Message, inspiration, speech",
    "A message arriving, wise words, a flash of inspiration.",
    "Misunderstanding, misleading speech, advice that goes unheard.",
    ["communication-expression", "messages-news", "learning-wisdom", "intuition-inner-knowing"]),
  "rune-raidho": m("Journey, rhythm, the right way",
    "A journey, steady movement, acting at the right time in the right way.",
    "Delay, a road that is harder than it looked, being out of step.",
    ["travel-journeys", "progress-momentum", "patience-waiting"]),
  "rune-kenaz": m("Torch, knowledge, craft",
    "A light that can be shared: skill, creativity, understanding that spreads.",
    "A flame that burns too hot, or goes out; in the Norse poems a sore that will not heal.",
    ["creativity-talent", "learning-wisdom", "energy-vitality"]),
  "rune-gebo": m("Gift, exchange, partnership",
    "A gift freely given, fair exchange, partnership in both directions.",
    "A gift with strings, a debt, giving that is not returned. (This rune looks the same turned over, so it does not reverse.)",
    ["generosity-giving", "partnership-marriage", "balance-moderation"]),
  "rune-wunjo": m("Joy, comfort, belonging",
    "Joy, ease, good company, the comfort of belonging.",
    "A joy that hides a sorrow, feeling cut off from the happiness around you.",
    ["joy-contentment", "community-belonging", "peace-harmony"]),
  "rune-hagalaz": m("Hail, disruption, forces beyond you",
    "A storm that clears the ground, change you did not choose that makes room.",
    "Damage and loss, a crisis you could not prevent.",
    ["change-transformation", "disaster-collapse", "struggle-resilience"]),
  "rune-nauthiz": m("Need, constraint, endurance",
    "Need as a teacher, endurance, the help that comes when you heed a real need in time.",
    "Scarcity, constraint, hardship that seems to have no end.",
    ["struggle-resilience", "acceptance-surrender", "wealth-prosperity"]),
  "rune-isa": m("Ice, stillness, pause",
    "Stillness that preserves, clarity, a pause with a purpose.",
    "Frozen in place, cold, cut off, nothing moving.",
    ["patience-waiting", "rest-selfcare", "solitude-reflection", "progress-momentum"]),
  "rune-jera": m("Year, harvest, cycles",
    "Reward in its season, a harvest earned by patient work.",
    "A harvest not yet ripe; impatience with a cycle that cannot be hurried.",
    ["work-craft", "patience-waiting", "nature-earth", "success-recognition"]),
  "rune-eihwaz": m("Yew, endurance, link between ending and beginning",
    "Endurance, continuity, the thread between one life stage and the next.",
    "Resisting an ending that is already underway; feeling stuck between two states.",
    ["struggle-resilience", "endings-release", "death-mortality", "spirituality-faith"]),
  "rune-perthro": m("Mystery, chance, what is hidden",
    "Mystery, play, chance, hidden things coming to light.",
    "Secrets, bad luck, or a gamble that has too much hold. (The meaning of the name itself is unknown.)",
    ["mystery-secrets", "fate-luck-karma", "play-humour", "compulsion-addiction"]),
  "rune-algiz": m("Protection, shelter, reaching higher",
    "Protection, a safe place, a connection to something larger than you.",
    "Feeling exposed or defensive; reaching out and getting scratched.",
    ["protection-boundaries", "spirituality-faith", "intuition-inner-knowing"]),
  "rune-sowilo": m("Sun, success, guidance",
    "Sunlight, success, vitality, a clear way ahead.",
    "Too much exposure, burn-out, a bright light that dazzles.",
    ["success-recognition", "energy-vitality", "hope-optimism"]),
  "rune-tiwaz": m("Justice, honour, willing sacrifice",
    "Justice, honour, courage, giving something up for something that matters.",
    "A sacrifice that goes too far, injustice, a lost sense of direction.",
    ["justice-law", "courage-strength", "acceptance-surrender", "truth-honesty-integrity"]),
  "rune-berkano": m("Birth, growth, home",
    "Birth, new growth, nurture, a home that shelters.",
    "Growth held back, trouble at home, care that smothers.",
    ["fertility-birth", "parenthood-caregiving", "family-home", "growth-maturity"]),
  "rune-ehwaz": m("Horse, partnership, steady movement",
    "Trust between partners, steady progress, horse and rider moving as one.",
    "Mistrust, stalled movement, going on without your partner.",
    ["partnership-marriage", "loyalty-trust-betrayal", "progress-momentum", "travel-journeys"]),
  "rune-mannaz": m("The self, humankind, community",
    "The self among others, community, shared human wit and help.",
    "Isolation, selfishness, the limits of one person; the old poem says each will fail the other.",
    ["community-belonging", "identity-individuality", "growth-maturity"]),
  "rune-laguz": m("Water, flow, intuition",
    "Flow, intuition, imagination, the healing of deep water.",
    "Overwhelm, fear of what lies below, a confusing sea.",
    ["intuition-inner-knowing", "emotional-expression", "dreams-vision", "fear-anxiety"]),
  "rune-ingwaz": m("Seed, fertility, completion before a new phase",
    "A seed gathered, fertility, a time of rest after finishing.",
    "Something unfinished, restlessness at the end of a phase. (This rune looks the same turned over, so it does not reverse.)",
    ["fertility-birth", "endings-release", "rest-selfcare", "new-beginnings"]),
  "rune-dagaz": m("Day, breakthrough, awakening",
    "Dawn, a breakthrough, a change of view that lets in the light.",
    "A change that arrives too bright and too fast. (This rune looks the same turned over, so it does not reverse.)",
    ["change-transformation", "hope-optimism", "new-beginnings", "intellect-clarity"]),
  "rune-othala": m("Heritage, home, belonging",
    "Heritage, home, what you were given by those before you.",
    "Clinging to an inheritance, old family wounds, being left out of the home.",
    ["family-home", "past-memory", "tradition-convention", "community-belonging"]),
};

// ---------------------------------------------------------------- Ogham (the 20 main letters)
export const OGHAM_MEANINGS: Record<string, CommonMeaning> = {
  "ogham-beith": m("Birch: beginning, cleansing",
    "A new beginning, a clearing out, the first tree to leaf.",
    "Holding on to the old, a start that does not take.",
    ["new-beginnings", "change-transformation"]),
  "ogham-luis": m("Rowan: protection, insight",
    "Protection, a quickening of insight, a charm against harm.",
    "Suspicion; a ward that turns into a wall.",
    ["protection-boundaries", "intuition-inner-knowing"]),
  "ogham-fearn": m("Alder: shelter, guidance, standing firm",
    "Shelter and guidance, the courage to stand where you are needed.",
    "Guardedness, stubbornness, standing firm when it is time to move.",
    ["protection-boundaries", "courage-strength", "support-guidance"]),
  "ogham-sail": m("Willow: flow, intuition, adapting",
    "Flow, intuition, bending with the tide.",
    "Moodiness, or giving way too easily.",
    ["flexibility-openness", "intuition-inner-knowing", "emotional-expression"]),
  "ogham-nion": m("Ash: connection, the web of events",
    "Connection between things, the sense of events woven together.",
    "Entanglement; feeling caught in a web you did not spin.",
    ["fate-luck-karma", "community-belonging", "spirituality-faith"]),
  "ogham-uath": m("Hawthorn: challenge, patience, cleansing",
    "Patience at a gate, cleansing, protection that has been earned.",
    "Fear, restraint, a painful wait. (The old name means horror or fear.)",
    ["patience-waiting", "protection-boundaries", "struggle-resilience", "fear-anxiety"]),
  "ogham-dair": m("Oak: strength, endurance, a doorway",
    "Strength, endurance, the doorway into something new.",
    "Rigidity, pride, a strength that cannot bend.",
    ["courage-strength", "security-stability", "power-authority"]),
  "ogham-tinne": m("Holly: courage, fair fight, balance",
    "Courage, a fair fight, balance between forces.",
    "Conflict for its own sake, a duel nobody needs.",
    ["courage-strength", "justice-law", "balance-moderation", "anger-conflict"]),
  "ogham-coll": m("Hazel: wisdom, creativity, knowledge gained",
    "Wisdom, creativity, the reward of long study and quiet attention.",
    "Knowledge kept to yourself, analysis that never reaches an answer.",
    ["learning-wisdom", "creativity-talent", "intuition-inner-knowing"]),
  "ogham-ceirt": m("Apple: choice, beauty, what you value",
    "A choice made with open eyes, beauty, love of what you value.",
    "Temptation, vanity, a choice made for how it looks.",
    ["decisions-choices", "beauty-charm", "love-romance"]),
  "ogham-muin": m("Vine: truth, expression, gathering",
    "Truth told freely, joyful expression, a gathering in.",
    "Words loosened by too much, indulgence, truth blurted out.",
    ["truth-honesty-integrity", "communication-expression", "joy-contentment", "compulsion-addiction"]),
  "ogham-gort": m("Ivy: growth, persistence, winding paths",
    "Growth that finds a way, persistence, a path that winds but gets there.",
    "Clinging, smothering, circling the same wall.",
    ["growth-maturity", "will-discipline", "flexibility-openness"]),
  "ogham-ngeadal": m("Reed: healing, clearing, making room",
    "Healing, a clearing that makes room, plain direction.",
    "A wounding word, bluntness, an ending that hurts. (The old name means killing or wounding.)",
    ["healing-health", "communication-expression", "endings-release"]),
  "ogham-straif": m("Blackthorn: fate, necessity, a hard turn",
    "A hard turn that clears the way, necessity met with grace.",
    "Hardship, strife, harm you did not choose.",
    ["fate-luck-karma", "struggle-resilience", "change-transformation"]),
  "ogham-ruis": m("Elder: endings and renewal",
    "An ending that makes way, the wisdom of age, renewal.",
    "Regret, grief, clinging to what has run its course.",
    ["endings-release", "death-mortality", "past-memory", "learning-wisdom"]),
  "ogham-ailm": m("Fir or pine: clarity, a wide view",
    "Clarity, a long view, far sight, steady endurance.",
    "Aloofness; looking so far ahead you miss what is near.",
    ["intellect-clarity", "dreams-vision", "struggle-resilience"]),
  "ogham-onn": m("Gorse: gathering, resilience, warmth",
    "Gathering, warmth, a flower that blooms in hard places.",
    "Prickliness, pushing through when you need rest.",
    ["hope-optimism", "struggle-resilience", "community-belonging"]),
  "ogham-ur": m("Heather: belonging, healing, passion",
    "Belonging, healing, passion rooted in the land you come from.",
    "Clinging to a place, possessiveness.",
    ["family-home", "healing-health", "love-romance", "nature-earth"]),
  "ogham-eadhadh": m("Aspen: perseverance, courage under pressure",
    "Perseverance, courage when your leaves are shaking, listening for messages in the wind.",
    "Trembling, fear, a nervous mind.",
    ["courage-strength", "fear-anxiety", "communication-expression"]),
  "ogham-iodhadh": m("Yew: endings that lead to beginnings",
    "An ending that leads to a beginning, long memory, transformation.",
    "Fixation on loss or the past.",
    ["death-mortality", "endings-release", "past-memory", "spirituality-faith"]),
};

// ---------------------------------------------------------------- Numbers (dice faces)
const NUMBER_MEANINGS: Record<number, CommonMeaning> = {
  1: m("Beginning, unity, the single point",
    "A beginning, initiative, a clear single point to start from.",
    "Isolation, stubbornness, a start that is only for yourself.",
    ["new-beginnings", "will-discipline", "identity-individuality"]),
  2: m("Pair, balance, choice",
    "Partnership, balance, a conversation between two.",
    "Indecision, opposition, being pulled two ways.",
    ["partnership-marriage", "decisions-choices", "balance-moderation"]),
  3: m("Creation, expression, growth",
    "Creativity, expression, joy that multiplies, something growing.",
    "Scattering, gossip, too many ideas and no form.",
    ["creativity-talent", "communication-expression", "joy-contentment"]),
  4: m("Foundation, structure, stability",
    "A firm foundation, order, something built to last.",
    "Rigidity, being boxed in, stability that has become a rut.",
    ["security-stability", "order-structure", "work-craft"]),
  5: m("Change, freedom, challenge",
    "Change, adventure, freedom, a challenge that stretches you.",
    "Instability, restlessness, conflict, loss of footing.",
    ["change-transformation", "independence-freedom", "struggle-resilience"]),
  6: m("Harmony, care, responsibility",
    "Harmony, care for others, home, balanced give and take.",
    "Over-responsibility, perfectionism, care that controls.",
    ["peace-harmony", "parenthood-caregiving", "family-home", "duty-responsibility"]),
  7: m("Reflection, inner life, study",
    "Reflection, study, inner knowing, the quiet that lets you hear yourself.",
    "Withdrawal, over-analysis, doubt, distance from others.",
    ["solitude-reflection", "learning-wisdom", "spirituality-faith"]),
  8: m("Power, achievement, abundance",
    "Achievement, abundance, power used well, the cycle that turns back on itself (the sideways 8 is infinity).",
    "Overwork, control, ambition at the cost of everything else.",
    ["success-recognition", "wealth-prosperity", "power-authority"]),
  9: m("Completion, compassion, release",
    "Completion, compassion, wisdom gathered, release of what is done.",
    "An ending you resist, bitterness, giving until empty.",
    ["endings-release", "kindness-compassion", "learning-wisdom"]),
  10: m("A full cycle and its restart",
    "A full cycle completed (1 and 0: the single point and the whole), ready to begin again.",
    "A cycle that will not close, burden at the end of a long climb.",
    ["endings-release", "new-beginnings", "success-recognition"]),
  11: m("Master number: intuition, illumination",
    "Intuition, illumination, a sudden clear insight.",
    "Nervous tension, high ideals that are hard to live up to.",
    ["intuition-inner-knowing", "spirituality-faith", "dreams-vision"]),
  12: m("The full circle: months, hours, signs",
    "A full circle, order across a whole year, completeness.",
    "Overextension, carrying the whole round alone.",
    ["fate-luck-karma", "order-structure", "community-belonging"]),
  13: m("Transformation, the thirteenth",
    "Transformation, a cycle turning over (the Death card is 13 in tarot).",
    "Fear of change; many cultures treat 13 as unlucky.",
    ["change-transformation", "endings-release", "fate-luck-karma"]),
  22: m("Master builder",
    "A master number: big ideas made real.",
    "Pressure from large expectations.",
    ["goals-planning", "work-craft", "success-recognition"]),
  33: m("Master teacher",
    "A master number: teaching and care for many.",
    "Taking on everyone's burdens.",
    ["learning-wisdom", "kindness-compassion", "support-guidance"]),
};

/** The steps of adding a number's digits until one digit is left. Numerology stops early at the master numbers 11, 22, 33. */
export function reductionSteps(n: number): { steps: string[]; result: number } {
  const steps: string[] = [];
  let x = n;
  while (x > 9 && ![11, 22, 33].includes(x)) {
    const digits = String(x).split("");
    const sum = digits.reduce((s, d) => s + Number(d), 0);
    steps.push(`${digits.join(" + ")} = ${sum}`);
    x = sum;
  }
  return { steps, result: x };
}

/** Common meaning of one number on a die, or of a face of a coin (see COIN_MEANINGS). `faces` is how many faces the die has. */
export function numberMeaning(n: number, faces: number): CommonMeaning & { reduction?: string; place: string } {
  const place =
    n === 1 ? "The lowest face this die can show." :
    n === faces ? `The highest face this die can show: the fullest it can say.` :
    n * 2 === faces ? "The middle of this die's range." :
    n < faces / 2 ? "In the lower half of this die." : "In the upper half of this die.";
  if (NUMBER_MEANINGS[n]) return { ...NUMBER_MEANINGS[n], place };
  const { steps, result: r } = reductionSteps(n);
  const base = NUMBER_MEANINGS[r];
  const reduction = `${n} reduces to ${r}: ${steps.join(", then ")}.`;
  const hundred = n === 100 ? " One hundred is a whole: all of it, every part counted." : "";
  return {
    keywords: `${base.keywords} (as ${n})`,
    light: `${base.light} At ${n} the archetype is carried further.${hundred}`,
    shadow: base.shadow,
    archetypes: base.archetypes,
    reduction,
    place,
  };
}

// ---------------------------------------------------------------- Coin
export const COIN_MEANINGS: Record<string, CommonMeaning> = {
  "coin-heads": m("Heads: the face shown, going ahead",
    "The face shown to the world: yes, go, say it aloud, move.",
    "Acting before you have looked underneath; being all front.",
    ["decisions-choices", "progress-momentum", "communication-expression"]),
  "coin-tails": m("Tails: the side beneath, waiting and looking within",
    "The side not shown: rest, wait, look beneath, keep it private for now.",
    "Hiding, holding back, putting off a decision that will not go away.",
    ["mystery-secrets", "patience-waiting", "solitude-reflection", "rest-selfcare"]),
};

// ---------------------------------------------------------------- Pendulum swings
export const PENDULUM_MEANINGS: Record<string, CommonMeaning> = {
  "swing-line-0": m("Back and forth: often yes",
    "Often read as yes: a clear forward and back, open and willing.",
    "Some guides read it as no or as neutral; set your own meaning first.",
    ["decisions-choices", "progress-momentum"]),
  "swing-line-90": m("Side to side: often no",
    "Often read as no: a boundary that protects.",
    "Some guides read it as yes or as neutral; set your own meaning first.",
    ["protection-boundaries", "decisions-choices", "patience-waiting"]),
  "swing-circle_cw": m("Clockwise circle: flowing, sunwise",
    "Clockwise is the sunwise way: flow, energy moving out, growth. Often read as yes.",
    "A loop that repeats without arriving anywhere.",
    ["energy-vitality", "progress-momentum", "hope-optimism"]),
  "swing-circle_ccw": m("Counter-clockwise circle: unwinding, releasing",
    "Counter-clockwise is unwinding: release, letting go, completion. Often read as no.",
    "Blocked, stuck, or a no that does not explain itself.",
    ["endings-release", "rest-selfcare", "struggle-resilience"]),
  "swing-still": m("Still: wait, unclear, ask another way",
    "Stillness: a pause, space, the question needs another shape or more time.",
    "No answer; feeling disconnected from the question.",
    ["patience-waiting", "solitude-reflection", "mystery-secrets"]),
};

/** The key a swing is kept under in PENDULUM_MEANINGS, or null for an added line (which has no stock words). */
export function pendulumKey(swing: { shape: string; angle: number | null; builtin?: number }): string | null {
  if (swing.shape === "circle_cw" || swing.shape === "circle_ccw" || swing.shape === "still") return `swing-${swing.shape}`;
  if (swing.builtin && swing.angle === 0) return "swing-line-0";
  if (swing.builtin && swing.angle === 90) return "swing-line-90";
  return null;
}

// ---------------------------------------------------------------- Scrying surfaces
export const SCRYING_MEANINGS: Record<string, CommonMeaning> = {
  "scrying-mirror": m("Dark mirror: depth and reflection",
    "A dark surface that gives little back, so what rises is your own: depth, honesty, reflection.",
    "Seeing only your fears, or sitting too long with the dark.",
    ["solitude-reflection", "mystery-secrets", "intuition-inner-knowing", "dreams-vision"]),
  "scrying-ball": m("Crystal ball: focus and clarity",
    "A clear sphere that gathers the eye: focus, clarity, patience with a still image.",
    "Straining to see, or reading too much into the shimmer.",
    ["focus-concentration", "dreams-vision", "magic-mysticism", "intuition-inner-knowing"]),
  "scrying-water": m("Bowl of water: feeling and flow",
    "Water that moves and mirrors: feeling, flow, calm after looking.",
    "Drowning in feeling, or reading ripples as signs when they are just ripples.",
    ["emotional-expression", "intuition-inner-knowing", "peace-harmony", "nature-earth"]),
};

/** The common meaning of any symbol id from any tool, or undefined. */
export function commonMeaningFor(id: string): CommonMeaning | undefined {
  return RUNE_MEANINGS[id] ?? OGHAM_MEANINGS[id] ?? COIN_MEANINGS[id] ?? PENDULUM_MEANINGS[id] ?? SCRYING_MEANINGS[id];
}
