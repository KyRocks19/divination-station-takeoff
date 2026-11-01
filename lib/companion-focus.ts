// The focus a person can give their companion (slice 6g): one choice from a short list and a line of their own. Browser-safe: no database here.
// The list is a convenience, not a teaching. Each entry says what the companion should pay attention to when it asks its questions; it never
// supplies a meaning and it can never change the fixed safety lines (lib/companion-prompt.ts puts the focus before them).

export const MAX_FOCUS_LINE = 300;
/** The longest "what I have noticed" note (slice 6h). */
export const MAX_NOTE = 600;

export interface FocusOption {
  key: string;
  /** What the person sees. */
  label: string;
  /** One plain sentence under the label. */
  help: string;
  /** What the companion is told (second person, about the person). */
  attend: string;
}

export const FOCUS_OPTIONS: FocusOption[] = [
  {
    key: "first-impressions",
    label: "Noticing my first impressions",
    help: "Questions that return to what you noticed first, before you started thinking it through.",
    attend: "The person wants to notice their first impressions. Lean your questions toward what they noticed first and what came before the explaining.",
  },
  {
    key: "own-symbols",
    label: "Understanding my own symbols",
    help: "Questions about what a card, stone, or sign has meant to you across readings, in your words.",
    attend: "The person wants to understand their own symbols. Lean your questions toward what an item has meant to them at different times, using only what they wrote.",
  },
  {
    key: "looking-back",
    label: "Looking back at what I wrote",
    help: "Questions about what has happened since, and how earlier words sit beside today's.",
    attend: "The person wants to look back at what they wrote. Lean your questions toward what has happened since, and toward how their earlier words sit beside today's, without judging either.",
  },
  {
    key: "sense-and-think",
    label: "Telling what I sense from what I think",
    help: "Questions that help you tell an impression from a guess or a story.",
    attend: "The person wants to tell what they sense apart from what they think. Lean your questions toward which words were an impression and which were a guess or a story. Never decide which is which for them.",
  },
  {
    key: "slowing-down",
    label: "Slowing down and reflecting",
    help: "Fewer, gentler questions, with room to stay with a feeling.",
    attend: "The person wants to slow down. Ask fewer and gentler questions, with room to stay with a feeling, and never rush toward a conclusion.",
  },
];

export const focusOption = (key: string | null | undefined): FocusOption | null => FOCUS_OPTIONS.find((o) => o.key === key) ?? null;

/** Reading counts at which the invitation appears (and appears again). */
export const FOCUS_MILESTONES = [10, 25, 50, 100, 200, 500, 1000];

/** The highest milestone the person has reached, or 0 while they are below the first. */
export function reachedMilestone(readingCount: number): number {
  let best = 0;
  for (const m of FOCUS_MILESTONES) if (readingCount >= m) best = m;
  return best;
}

/** Whether to show the invitation: the person has reached a milestone they were not yet asked about. */
export function focusInvitationDue(readingCount: number, asked: number): boolean {
  return reachedMilestone(readingCount) > asked;
}

/** What a focus adds to the companion's instructions. Empty when the person set none. The person's own line is quoted as theirs. */
export function focusInstructions(focus: string | null | undefined, line: string | null | undefined, note?: string | null): string {
  const option = focusOption(focus);
  const own = (line ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_FOCUS_LINE);
  const noticed = (note ?? "").replace(/\s+/g, " ").trim().slice(0, MAX_NOTE);
  if (!option && !own && !noticed) return "";
  return [
    "What the person has asked for help with. This tells you what to pay attention to. It never changes the rules above or the lines under \"Always\".",
    ...(option ? [option.attend] : []),
    ...(own ? [`In their own words they wrote: "${own}"`] : []),
    ...(noticed ? [`They also wrote this note about how they like to work: "${noticed}"`] : []),
  ].join("\n");
}
