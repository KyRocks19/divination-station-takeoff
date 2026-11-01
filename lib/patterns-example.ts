// Example data for the Patterns page (release plan §6 idea 7, owner decision 2026-10-22): what about thirty days of use looks like, for a new
// person or a reviewer. It is made here, in code, every time it is shown, and never stored: nothing is written to the account, so there is nothing
// to delete and nothing that could mix with the person's own readings. The page says plainly that it is an example.
// Pure: no database, so the tests can check it. Every word below is invented for the example and belongs to nobody.

import type { MonthThemes, Recurring, Shift, WhenCounts } from "./patterns-core";
import type { OwnMonthThemes } from "./own-tallies-core";
import type { ConfidenceRow, FitMonth, TagFit } from "./guess-core";

export interface ExamplePatterns {
  example: true;
  when: WhenCounts;
  themes: MonthThemes[];
  ownThemes: OwnMonthThemes[];
  recurring: Recurring[];
  shifts: Shift[];
  fits: FitMonth[];
  confidence: ConfidenceRow[];
  tagFits: TagFit[];
  overallFit: number | null;
}

/** Example links lead nowhere real: the example has no readings to open. */
const NOWHERE = "/insights";

export function examplePatterns(): ExamplePatterns {
  return {
    example: true,
    when: {
      total: 30,
      noSky: 2,
      noTimeZone: 0,
      partOfDay: [
        { label: "Early morning (5am to noon)", count: 12 },
        { label: "Afternoon (noon to 5pm)", count: 4 },
        { label: "Evening (5pm to 10pm)", count: 9 },
        { label: "Night (10pm to 5am)", count: 3 },
      ],
      weekday: [
        { label: "Sunday", count: 7 }, { label: "Monday", count: 3 }, { label: "Tuesday", count: 4 }, { label: "Wednesday", count: 2 },
        { label: "Thursday", count: 5 }, { label: "Friday", count: 3 }, { label: "Saturday", count: 4 },
      ],
      moonPhase: [
        { label: "New Moon", count: 3 }, { label: "Waxing Crescent", count: 4 }, { label: "First Quarter", count: 2 }, { label: "Waxing Gibbous", count: 3 },
        { label: "Full Moon", count: 6 }, { label: "Waning Gibbous", count: 4 }, { label: "Last Quarter", count: 3 }, { label: "Waning Crescent", count: 3 },
      ],
      festival: [{ label: "Mabon", count: 18 }, { label: "Samhain", count: 10 }],
    },
    themes: [
      { month: "2026-10", themes: [{ slug: "new-beginnings", name: "New Beginnings", count: 6 }, { slug: "change-transformation", name: "Change and Transformation", count: 4 }, { slug: "courage-strength", name: "Courage and Strength", count: 3 }] },
      { month: "2026-09", themes: [{ slug: "endings-release", name: "Endings and Release", count: 5 }, { slug: "confidence-self-worth", name: "Confidence and Self-worth", count: 2 }] },
    ],
    ownThemes: [{ month: "2026-10", themes: [{ key: "example-own", name: "The kitchen table", kind: "your archetype", count: 3 }] }],
    recurring: [
      { kind: "runes", key: "example-1", name: "Raidho", count: 4, entries: [{ when: "2026-09-28T08:00:00Z", href: NOWHERE, id: 0 }, { when: "2026-10-05T08:00:00Z", href: NOWHERE, id: 0 }, { when: "2026-10-12T08:00:00Z", href: NOWHERE, id: 0 }, { when: "2026-10-19T08:00:00Z", href: NOWHERE, id: 0 }], earlier: 0 },
      { kind: "tarot", key: "example-2", name: "Eight of Cups", count: 3, entries: [{ when: "2026-09-30T20:00:00Z", href: NOWHERE, id: 0 }, { when: "2026-10-09T20:00:00Z", href: NOWHERE, id: 0 }, { when: "2026-10-18T20:00:00Z", href: NOWHERE, id: 0 }], earlier: 0 },
    ],
    shifts: [
      {
        kind: "runes", key: "example-1", name: "Raidho",
        versions: [
          { when: "2026-09-28T08:00:00Z", text: "A journey I have to make." },
          { when: "2026-10-19T08:00:00Z", text: "Not a trip: the way I go about things." },
        ],
      },
    ],
    fits: [
      { month: "2026-10", counts: { 1: 1, 2: 2, 3: 4, 4: 5, 5: 2 }, rated: 14, average: 3.4 },
      { month: "2026-09", counts: { 1: 2, 2: 3, 3: 2, 4: 1, 5: 0 }, rated: 8, average: 2.3 },
    ],
    confidence: [
      { confidence: 5, rated: 9, fittedWell: 5 },
      { confidence: 3, rated: 6, fittedWell: 2 },
      { confidence: 1, rated: 7, fittedWell: 1 },
    ],
    tagFits: [
      { tag: "rested", rated: 9, average: 3.6 },
      { tag: "rushed", rated: 6, average: 2.5 },
      { tag: "after a walk", rated: 3, average: null },
    ],
    overallFit: 3,
  };
}
