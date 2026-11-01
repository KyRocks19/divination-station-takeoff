// What the AI companion can be asked to do. No server code here, so pages can import it.
//   questions  asks the person open questions about their own words (the default and the heart of the companion)
//   changes    sets the person's own words from different times in order, built in code with no model, without saying what the change means
//   reading    offers one short reading built only from the person's own words, when they ask for it
//   scene      suggests ideas for a picture of one item, from the person's own words about it
//   pattern    asks questions about a pattern on the Patterns page (a symbol that keeps coming up, or whose wording has shifted), from the person's own dates and words
//   noticed    suggests one line for the person's own "what I have noticed" note, from counts the app made in code (about the person, not a reading)

export const COMPANION_MODES = ["questions", "changes", "reading", "scene", "noticed", "pattern"] as const;
export type CompanionMode = (typeof COMPANION_MODES)[number];

export const isCompanionMode = (m: unknown): m is CompanionMode => COMPANION_MODES.includes(m as CompanionMode);

/**
 * The modes that ask the model. "changes" does not: it is the person's own words in the order they wrote them, built in code (a small model
 * misdated and misquoted them when it was asked to), so it is exact, instant, and works while the studio is asleep.
 */
export type ModelMode = Exclude<CompanionMode, "changes">;

/** The button for each mode. */
export const MODE_BUTTONS: Record<CompanionMode, string> = {
  questions: "Ask me questions",
  changes: "What has changed",
  reading: "Offer a reading from my words",
  scene: "Suggest picture ideas",
  noticed: "Suggest a line",
  pattern: "Ask me a question about this",
};

/** What a kept answer is called. */
export const MODE_TITLES: Record<CompanionMode, string> = {
  questions: "Questions",
  changes: "What has changed",
  reading: "A reading from your words",
  scene: "Picture ideas",
  noticed: "A suggested line",
  pattern: "Questions about a pattern",
};

/** One plain line under each button saying what it does. */
export const MODE_HELP: Record<CompanionMode, string> = {
  questions: "Asks a few questions that quote your own words.",
  changes: "Your own words in the order you wrote them, exactly as you wrote them. Nothing is sent to the AI, nothing is added, and it does not say what the change means.",
  reading: "One short reading built only from what you wrote. It is one way of looking, not the answer.",
  scene: "A few ideas for a picture, drawn only from your own words about this item.",
  noticed: "One line you could use for your note, drawn only from the counts shown above. You choose whether to use it.",
  pattern: "A few questions about this pattern that quote your own words and dates. It does not say what the pattern means.",
};
