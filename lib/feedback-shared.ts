// The parts of feedback that the browser also needs (no database code).

export const KINDS = ["bug", "idea", "confusing", "other"] as const;
export type FeedbackKind = (typeof KINDS)[number];
export const STATUSES = ["new", "seen", "done"] as const;
export type FeedbackStatus = (typeof STATUSES)[number];

export const KIND_LABELS: Record<FeedbackKind, string> = {
  bug: "Something is broken",
  idea: "An idea",
  confusing: "Something is confusing",
  other: "Something else",
};

export const MAX_MESSAGE = 4000;
export const MAX_REPLY = 2000;
