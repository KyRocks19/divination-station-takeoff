// The shared language: root archetypal concepts that tarot concepts and every other tool's symbols are matched to.
// This file touches no database code, so screens that run in the browser can import it.
//
// How it works (decided with the user 2026-10-12): each archetype is a pattern of human experience, not a verdict.
// Every one has a light side and a shadow side, because an archetype is lived both ways; the words lean gentle and
// still say the hard part. A tarot concept ("lack of confidence") sits under one archetype with an aspect
// (light, shadow, or neutral); a rune, a stave, a die face, a swing, a surface is matched to the same archetypes.
// Two different tools that touch the same archetype can then be shown side by side in plain, shared words.
//
// Rule from the oracle design (SKILL.md, rule 1): these words are stock text, a placeholder to start from. They
// are never written into a person's own meanings, and the person's words always come first.

export type Aspect = "light" | "shadow" | "neutral";

export interface Archetype {
  /** Stable id, for example "courage-strength". */
  slug: string;
  name: string;
  /** The group it is shown under. */
  realm: string;
  /** What the archetype is, in one plain sentence. */
  summary: string;
  /** How the archetype feels when it is flowing. */
  light: string;
  /** How the archetype feels when it is strained, blocked, or overdone. */
  shadow: string;
}

export const REALMS = [
  "Beginnings and endings",
  "Self",
  "Heart and feeling",
  "Bonds",
  "Home and family",
  "Mind and voice",
  "Spirit and mystery",
  "Work and wealth",
  "Order and justice",
  "Movement and choice",
  "Trial and shelter",
  "Body and health",
] as const;

function a(slug: string, name: string, realm: (typeof REALMS)[number], summary: string, light: string, shadow: string): Archetype {
  return { slug, name, realm, summary, light, shadow };
}

export const ARCHETYPES: Archetype[] = [
  // Beginnings and endings
  a("new-beginnings", "New Beginnings", REALMS[0], "Starting again, fresh starts, first steps, and the open space before anything is decided.",
    "A clean page, a first step taken with trust, the energy of something just born.",
    "Fear of starting, a beginning that never gets going, or a fresh start that is really an escape."),
  a("endings-release", "Endings and Release", REALMS[0], "Closing a chapter, letting go, and what comes after.",
    "Relief, closure, room made for what is next, grief honoured and put down.",
    "Clinging to what is over, an ending that is unfinished, or a loss that has not yet been mourned."),
  a("change-transformation", "Change and Transformation", REALMS[0], "Upheaval, turning points, and becoming something new.",
    "Renewal, awakening, the old shell breaking so something truer can live.",
    "Sudden shock, change nobody chose, resisting what is already happening."),
  a("fate-luck-karma", "Fate, Luck and Karma", REALMS[0], "Chance, destiny, cycles, and cause and effect.",
    "Good fortune, a turn of the wheel in your favour, the sense of being part of a larger pattern.",
    "Bad luck, repeating cycles, consequences arriving, the feeling that things are out of your hands."),
  a("death-mortality", "Death and Mortality", REALMS[0], "Death, bereavement, and the edge of life.",
    "Honouring the dead, valuing the time there is, a threshold crossed with care.",
    "Fear of death, sudden loss, or being unable to say goodbye."),

  // Self
  a("courage-strength", "Courage and Strength", REALMS[1], "Inner and outer strength, bravery, and standing firm.",
    "Steady courage, resilience, the power to act despite fear.",
    "Weakness, cowardice, or strength used as a wall instead of a bridge."),
  a("confidence-self-worth", "Confidence and Self-worth", REALMS[1], "How you see your own value and ability.",
    "Quiet self-belief, healthy self-esteem, trusting your own judgement.",
    "Self-doubt, feeling not enough, shyness that keeps you from being seen."),
  a("pride-ego-humility", "Pride, Ego and Humility", REALMS[1], "Pride in what you have done, and the pull of the ego.",
    "Honest pride in your work, dignity, enough ego to stand up for yourself.",
    "Arrogance, vanity, self-absorption, a need to be seen as better."),
  a("will-discipline", "Will and Discipline", REALMS[1], "Willpower, motivation, persistence, and self-control.",
    "Steady effort, follow-through, a habit that carries you when mood does not.",
    "Laziness, procrastination, lost motivation, or a will that has hardened into stubbornness."),
  a("identity-individuality", "Identity and Individuality", REALMS[1], "Being yourself: originality, difference, and who you love and are.",
    "Authenticity, the courage to be different, pride in who you are.",
    "Hiding yourself, fear of standing out, or being pushed into a shape that is not yours."),
  a("independence-freedom", "Freedom and Independence", REALMS[1], "Freedom, self-reliance, spontaneity, and the open road.",
    "Room to move, trusting yourself, a free spirit.",
    "Feeling trapped, confined, restricted, or tied down by others or by circumstance; freedom used to avoid closeness."),
  a("growth-maturity", "Growth and Maturity", REALMS[1], "Growing, bettering yourself, and growing up.",
    "Learning from life, deepening, becoming more fully yourself.",
    "Stalled growth, immaturity, or growth that came only through pain."),
  a("youth-innocence", "Youth and Innocence", REALMS[1], "The child, the young, innocence, and the childlike.",
    "Wonder, trust, a fresh and curious way of seeing.",
    "Naivety, being taken advantage of, innocence lost too soon, or refusing to grow up."),
  a("beauty-charm", "Beauty, Charm and Style", REALMS[1], "Beauty, grace, charisma, and how you present yourself.",
    "Grace, charm, a sense of style that is your own, delight in beauty.",
    "Vanity, superficiality, being valued only for looks, or using charm to get your way."),

  // Heart and feeling
  a("joy-contentment", "Joy and Contentment", REALMS[2], "Happiness, satisfaction, fulfilment, and wellbeing.",
    "Real joy, a settled heart, the sense that enough is enough.",
    "Joylessness, discontent, always looking at the greener grass, or happiness that is a mask."),
  a("play-humour", "Play, Fun and Humour", REALMS[2], "Play, laughter, wit, and lightness.",
    "Laughter, play, a quick wit that lifts a room.",
    "Boredom, silliness that avoids the serious, or humour used as a weapon."),
  a("grief-sorrow", "Grief and Sorrow", REALMS[2], "Sadness, loss, mourning, and heartbreak.",
    "Tears that heal, mourning that honours, tenderness after loss.",
    "Despair, being stuck in sorrow, or sorrow with no one to share it."),
  a("fear-anxiety", "Fear and Anxiety", REALMS[2], "Fear, worry, and the unknown.",
    "Fear as a signal worth hearing, and the courage that comes after facing it.",
    "Paralysing fear, anxiety, paranoia, or fears that grow in the dark."),
  a("anger-conflict", "Anger and Conflict", REALMS[2], "Anger, arguments, fighting, and opposition.",
    "Honest anger that protects a boundary, a fight worth having, passion with direction.",
    "Aggression, hot temper, feuds, war, or anger turned inward."),
  a("guilt-shame-regret", "Guilt, Shame and Regret", REALMS[2], "Remorse, conscience, and wishing it had been otherwise.",
    "A working conscience, coming clean, learning from a mistake.",
    "Crushing shame, regret that goes round and round, humiliation."),
  a("jealousy-envy", "Jealousy and Envy", REALMS[2], "Wanting what another has, and fearing to lose what you have.",
    "A pointer to what you truly want, if you can listen without acting on it.",
    "Possessiveness, resentment, comparison that sours everything."),
  a("forgiveness-reconciliation", "Forgiveness and Reconciliation", REALMS[2], "Forgiving, making peace again, and the grudge that gets in the way.",
    "Forgiveness, repair, a door reopened or gently closed in peace.",
    "Grudges, bitterness, revenge, spite, holding resentment as if it were safety."),
  a("hope-optimism", "Hope and Optimism", REALMS[2], "Hope, faith in the future, and a positive outlook.",
    "A light at the end of the tunnel, realistic optimism, hope that keeps you going.",
    "Hopelessness, cynicism, pessimism, or hope used to avoid looking at what is."),
  a("emotional-expression", "Emotional Openness", REALMS[2], "Sensitivity, empathy, and how freely you feel and show it.",
    "Tenderness, empathy, being able to feel and say what you feel.",
    "Coldness, repressed feeling, moodiness, being overwhelmed by feeling, or being guarded."),
  a("mental-health", "Mind and Mood", REALMS[2], "Depression, trauma, breakdown, and recovery of the mind.",
    "Recovery, therapy, being met with care, finding steadier ground.",
    "Depression, trauma, breakdown, nightmares, the feeling of the mind turning on itself."),
  a("kindness-compassion", "Kindness and Compassion", REALMS[2], "Kindness, warmth, gentleness, and caring for others.",
    "Warmth, patience with others, a gentle hand.",
    "Cruelty, coldness, meanness, or kindness that forgets yourself."),

  // Bonds
  a("love-romance", "Love and Romance", REALMS[3], "Love, attraction, romance, and the heart opening.",
    "Being swept off your feet, mutual love, tenderness, a soulmate recognised.",
    "Unrequited love, infatuation, love that smothers, a heart held shut."),
  a("partnership-marriage", "Partnership and Marriage", REALMS[3], "Marriage, weddings, engagements, and long relationships.",
    "A union that holds, shared values, a partner who shows up.",
    "Unhappy partnership, a bond kept out of habit, broken engagement."),
  a("loyalty-trust-betrayal", "Loyalty, Trust and Betrayal", REALMS[3], "Fidelity, faithfulness, and the breaking of trust.",
    "Dependability, fidelity, trust earned over time.",
    "Betrayal, cheating, backstabbing, trust issues, divided loyalty."),
  a("separation-breakup", "Separation and Breakup", REALMS[3], "Splitting, divorce, goodbyes, and abandonment.",
    "A parting that frees both people, a clean goodbye, room to be whole alone.",
    "Abandonment, divorce, a broken home, a bond torn rather than untied."),
  a("sensuality-sexuality", "Sensuality and Sexuality", REALMS[3], "The body, desire, pleasure, and sexual life.",
    "Pleasure, embodied joy, healthy desire.",
    "Exploitation, compulsive or unwanted attention, desire without care."),
  a("community-belonging", "Community and Belonging", REALMS[3], "Friends, community, teamwork, and being welcome.",
    "Friendship, belonging, working together, being welcomed.",
    "Exclusion, loneliness in a crowd, not fitting in, mob mentality."),
  a("support-guidance", "Support and Guidance", REALMS[3], "Help given and received, mentors, and counsel.",
    "Accepting help, a good teacher, being held up.",
    "Unsupportive people, being beyond help, refusing counsel."),
  a("harm-abuse", "Harm, Abuse and Violence", REALMS[3], "Violence, abuse, bullying, and the mistreatment of others.",
    "Naming harm, being believed, standing up to abuse, safety found.",
    "Abuse, violence, bullying, persecution, exploitation, assault."),

  // Home and family
  a("family-home", "Family and Home", REALMS[4], "Family, home, ancestry, and where you come from.",
    "A home that shelters, family gathered, belonging.",
    "Family feuds, dysfunction, a home that is not safe, family secrets, burdens."),
  a("parenthood-caregiving", "Parenthood and Caregiving", REALMS[4], "Mothers, fathers, nurturing, and providing.",
    "Nurturing, providing, a parent who is present and warm.",
    "Absent or neglectful parents, smothering, parenting that wounds."),
  a("fertility-birth", "Fertility, Pregnancy and Birth", REALMS[4], "Conception, pregnancy, birth, and their losses.",
    "Conception, a safe pregnancy, new life, birth.",
    "Infertility, miscarriage, stillbirth, hard choices around pregnancy."),

  // Mind and voice
  a("intellect-clarity", "Intellect and Clarity", REALMS[5], "Thinking clearly, logic, intelligence, and mental sharpness.",
    "Clear thinking, good judgement, a mind that cuts to what matters.",
    "Confusion, overthinking, a foggy or overloaded mind, cold logic without heart."),
  a("communication-expression", "Communication and Expression", REALMS[5], "Speaking, listening, writing, and being understood.",
    "Saying it plainly, being heard, good conversation.",
    "Misunderstanding, silence, saying too much or too little."),
  a("messages-news", "Messages and News", REALMS[5], "News, letters, calls, and messages arriving.",
    "Good news arriving, a message that clears the air.",
    "Bad or delayed news, misinformation, messages that do not get through."),
  a("gossip-slander", "Gossip and Slander", REALMS[5], "Gossip, rumours, and words used to hurt.",
    "Rising above it, knowing who to trust with what.",
    "Gossip, slander, badmouthing, being the subject of rumours."),
  a("truth-honesty-integrity", "Truth, Honesty and Integrity", REALMS[5], "Honesty, truthfulness, honour, and deception.",
    "Plain honesty, integrity, truth told kindly.",
    "Lies, deception, manipulation, scams, a lack of integrity."),
  a("learning-wisdom", "Learning and Wisdom", REALMS[5], "Study, skill, knowledge, and hard-won wisdom.",
    "Curiosity, mastery, wisdom that comes from experience.",
    "Refusing to learn, ignorance, learning that is never used."),
  a("focus-concentration", "Focus and Concentration", REALMS[5], "Attention, focus, and single-minded effort.",
    "A mind gathered on one thing, deep attention.",
    "Scattered attention, distraction, difficulty concentrating."),
  a("illusion-denial", "Illusion and Denial", REALMS[5], "Fantasy, wishful thinking, and not seeing what is there.",
    "Imagination in service of truth, an illusion seen through.",
    "Self-deception, denial, unrealistic expectations, hallucination."),
  a("decisions-choices", "Choices and Decisions", REALMS[5], "Crossroads, options, and deciding.",
    "A clear decision, a path chosen with open eyes.",
    "Indecision, being torn, painful choices, deciding in haste."),

  // Spirit and mystery
  a("intuition-inner-knowing", "Intuition and Inner Knowing", REALMS[6], "Inner voice, psychic sense, the subconscious.",
    "Trusting a quiet knowing, listening inward, an inner voice that guides.",
    "A blocked or ignored inner voice, intuition mistaken for fear."),
  a("divination", "Divination", REALMS[6], "Asking for a sign, reading chance, and looking at a question from a side you would not have picked.",
    "Curiosity, a fresh angle on a stuck question, listening to what a pull stirs up in you.",
    "Asking again until the answer suits, handing a choice over to chance, dread of what a reading might say."),
  a("spirituality-faith", "Spirituality and Faith", REALMS[6], "Faith, higher power, religion, and the sacred.",
    "Faith, meaning, a sense of being held by something larger.",
    "Loss of faith, dogma, spiritual bypassing, an emptiness where meaning was."),
  a("magic-mysticism", "Magic and Mysticism", REALMS[6], "Magic, the occult, and manifestation.",
    "Craft, ritual, wishes that become real, work with the unseen.",
    "Obsession with the occult, curses, magic used to control."),
  a("mystery-secrets", "Mystery, Secrets and Revelation", REALMS[6], "What is hidden, and the moment it comes to light.",
    "A mystery that invites, a secret kept for good reason, truth coming to light.",
    "Secrecy that isolates, being kept in the dark, exposure at a bad moment."),
  a("dreams-vision", "Dreams and Vision", REALMS[6], "Dreams, daydreams, wishes, and the picture of what could be.",
    "A clear vision, dreams worth working toward, wishes that come true.",
    "Daydreams used to dodge life, broken dreams, nightmares."),
  a("solitude-reflection", "Solitude and Reflection", REALMS[6], "Time alone, introspection, retreat, and loneliness.",
    "Chosen solitude, meditation, self-reflection, a retreat that restores.",
    "Loneliness, isolation, withdrawal, being left outside."),
  a("past-memory", "The Past and Memory", REALMS[6], "Memory, nostalgia, heritage, and what the past still asks of you.",
    "Remembering with love, learning from history, an inheritance of strength.",
    "Being stuck in the past, haunted by it, old patterns repeating."),
  a("nature-earth", "Nature and Earth", REALMS[6], "The natural world, seasons, growing things, and the land.",
    "Grounding in nature, the harvest, working with the seasons.",
    "Disconnection from nature, floods and storms, neglected land."),
  a("creativity-talent", "Creativity and Talent", REALMS[6], "Art, inspiration, ideas, and gifts.",
    "Inspiration, making things, talent in use, bright ideas.",
    "Creative block, wasted talent, ideas that never reach the world."),

  // Work and wealth
  a("wealth-prosperity", "Wealth and Prosperity", REALMS[7], "Money, abundance, assets, and the lack of them.",
    "Abundance, prosperity, good fortune with money, enough to share.",
    "Debt, poverty, loss, financial stress, money that costs more than it gives."),
  a("security-stability", "Security and Stability", REALMS[7], "Safe ground, foundations, and the feeling of being secure.",
    "Solid foundations, security, a place to stand.",
    "Instability, insecurity, rocky foundations."),
  a("work-craft", "Work and Craft", REALMS[7], "Jobs, craft, effort, and quality of work.",
    "Hard work that pays off, craft, pride in the doing.",
    "Drudgery, overwork, a dead-end job, shoddy work, no reward for effort."),
  a("business-enterprise", "Business and Enterprise", REALMS[7], "Starting and running ventures, trade, and investments.",
    "A venture growing, good partnerships, trade that flourishes.",
    "Failed ventures, scams, bad business partners."),
  a("success-recognition", "Success and Recognition", REALMS[7], "Winning, achievement, fame, and being acknowledged.",
    "Victory, triumph, recognition, a goal reached.",
    "Failure, defeat, being overlooked, success that feels empty."),
  a("goals-planning", "Goals and Planning", REALMS[7], "Plans, strategy, foresight, and groundwork.",
    "A good plan, foresight, foundations laid, steady steps toward a goal.",
    "No plan, unworkable plans, plans abandoned, aimlessness."),
  a("generosity-giving", "Generosity and Giving", REALMS[7], "Giving, sharing, receiving, and gratitude.",
    "Open-handed giving, gratitude, gifts freely given and received.",
    "Greed, stinginess, hoarding, giving too much, gifts with strings."),
  a("duty-responsibility", "Duty and Responsibility", REALMS[7], "Duty, commitment, and what you are answerable for.",
    "Reliability, commitment kept, carrying your share.",
    "Shirking, broken promises, fear of commitment, duty that crushes."),

  // Order and justice
  a("order-structure", "Order and Structure", REALMS[8], "Organisation, routine, systems, and the frame things sit in.",
    "Clear structure, good routine, order that frees you.",
    "Chaos, disorder, disorganisation; or order so tight it chokes."),
  a("justice-law", "Justice and Law", REALMS[8], "Fairness, law, courts, ethics, and consequences.",
    "Fairness, truth weighed, a just result, accountability.",
    "Injustice, corruption, crime, false accusation, legal trouble."),
  a("power-authority", "Power, Authority and Leadership", REALMS[8], "Leading, authority, control, and influence.",
    "Leadership that serves, empowerment, taking charge well.",
    "Abuse of power, domination, control, powerlessness."),
  a("tradition-convention", "Tradition and Convention", REALMS[8], "Customs, institutions, and the way things have been done.",
    "Roots, continuity, wisdom that has lasted.",
    "Rigid rules, conformity for its own sake."),
  a("flexibility-openness", "Flexibility and Open-mindedness", REALMS[8], "Adapting, bending, and being willing to see another way.",
    "Adaptability, open mind, going with the flow.",
    "Rigidity, stubbornness, a closed mind, resisting change."),
  a("diplomacy-compromise", "Diplomacy and Compromise", REALMS[8], "Tact, negotiation, manners, and meeting halfway.",
    "Tact, negotiation, mutual respect, a fair deal.",
    "Rudeness, tactlessness, refusing to meet anyone halfway."),
  a("balance-moderation", "Balance and Moderation", REALMS[8], "Equilibrium, harmony of parts, enough and not too much.",
    "Balance, harmony, the middle way.",
    "Imbalance, excess, one thing swallowing the rest."),
  a("compulsion-addiction", "Compulsion and Addiction", REALMS[8], "Addiction, obsession, gambling, and what has hold of you.",
    "Recovery, sobriety, freedom regained.",
    "Addiction, obsession, dependency, compulsive habits."),

  // Movement and choice
  a("travel-journeys", "Travel and Journeys", REALMS[9], "Travel, moving, journeys, and holidays.",
    "Adventure, a journey that opens you, moving to somewhere better.",
    "Cancelled or delayed travel, homesickness, running away."),
  a("progress-momentum", "Progress and Momentum", REALMS[9], "Moving forward, speed, and getting unstuck.",
    "Progress, momentum, a breakthrough, things moving.",
    "Stagnation, delays, being stuck in a rut, setbacks."),
  a("risk-daring", "Risk, Daring and Caution", REALMS[9], "Boldness, risk, impulse, and the care that balances them.",
    "Daring, adventure, a risk worth taking, healthy caution.",
    "Recklessness, impulsiveness, carelessness; or caution so strong nothing is tried."),
  a("patience-waiting", "Patience and Waiting", REALMS[9], "Waiting, timing, and impatience.",
    "Patience, trusting the timing, using the pause well.",
    "Impatience, rushing, waiting that turns into avoidance."),
  a("rest-selfcare", "Rest and Self-care", REALMS[9], "Rest, recovery, pampering, and looking after yourself.",
    "Rest, restoration, kindness toward your own body.",
    "Neglecting yourself, no time for rest, collapse from overwork."),
  a("energy-vitality", "Energy and Vitality", REALMS[9], "Drive, enthusiasm, stamina, zest for life.",
    "Enthusiasm, zest, strong energy for what matters.",
    "Exhaustion, apathy, lethargy, burn-out."),
  a("acceptance-surrender", "Acceptance and Surrender", REALMS[9], "Yielding, sacrifice, accepting what is.",
    "Acceptance, a chosen sacrifice, surrender that brings peace.",
    "Martyrdom, being a doormat, playing the victim, giving up."),

  // Trial and shelter
  a("struggle-resilience", "Struggle and Resilience", REALMS[10], "Hardship, obstacles, and coming through.",
    "Overcoming, surviving, learning from hard times, the end of hardship.",
    "Rock bottom, giving up, obstacles that feel impossible."),
  a("stress-overwhelm", "Stress and Overwhelm", REALMS[10], "Pressure, burden, too much on your plate.",
    "Knowing your limits, setting a load down.",
    "Overload, burn-out, juggling too much, pressure and worry."),
  a("protection-boundaries", "Protection and Boundaries", REALMS[10], "Safety, defence, boundaries, and sanctuary.",
    "Healthy boundaries, a safe place, being protected.",
    "Defensiveness, walls, paranoia, failing to protect."),
  a("disaster-collapse", "Disaster and Collapse", REALMS[10], "Catastrophe, ruin, danger, and surviving.",
    "A disaster averted, survival, rebuilding after ruin.",
    "Disaster, ruin, collapse, danger, accidents."),
  a("peace-harmony", "Peace and Harmony", REALMS[10], "Calm, peace, serenity, and getting along.",
    "Calm, serenity, harmony, a truce, quiet.",
    "False peace, avoiding every conflict, calm that is really numbness."),

  // Body and health
  a("healing-health", "Healing and Health", REALMS[11], "The body's health, illness, and recovery.",
    "Healing, recovery, good health, a body treated well.",
    "Illness, injury, hospital, a body pushed past its limit."),
];

const BY_SLUG = new Map(ARCHETYPES.map((x) => [x.slug, x]));

export function getArchetype(slug: string): Archetype | undefined {
  return BY_SLUG.get(slug);
}
