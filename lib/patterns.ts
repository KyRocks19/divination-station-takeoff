import { query } from "./db";
import { toISOString } from "./date";
import { getArchetype } from "./archetypes-data";
import { archetypeMonths, archetypeTalliesFor } from "./archetype-tallies";
import { MOON_PHASE_ORDER } from "./sky";
import type { DivinationKind } from "./divination-kinds";
import { loadRecurring, loadShifts } from "./patterns-symbols";
import { ownTallies, ownThemeMonths } from "./own-tallies";
import type { OwnMonthThemes } from "./own-tallies-core";
import { confidenceVsFit, fitByTag, fitsByMonth, overallFit, type Confidence, type ConfidenceRow, type Fit, type FitMonth, type TagFit } from "./guess-core";
import { NOTE_WORD_KIND, recurringNoteWords, type NoteWord } from "./note-words-core";
import { themesByMonth, topThemes, whenCounts, type MonthThemes, type TopTheme, type Recurring, type Shift, type SkyFields, type WhenCounts } from "./patterns-core";

// The Patterns page's "across all your tools" block (slice 7): when the person reads, themes over time, symbols that keep coming up, and how their
// own wording has shifted. Everything is counted and dated in code from the person's own rows, so nothing is misdated or invented, and nothing
// here is shared with anyone: every query is for one person. `only` limits it to the tools the person has chosen to see (null for every tool).

export interface Patterns {
  when: WhenCounts;
  themes: MonthThemes[];
  /** Themes over time for the person's own archetypes and concepts, apart from the shared ones and never added to them. */
  ownThemes: OwnMonthThemes[];
  recurring: Recurring[];
  shifts: Shift[];
  /** How well the person said what they sensed first fitted, month by month (GF1 f). */
  fits: FitMonth[];
  /** How sure the person felt against how well it fitted (idea 1). */
  confidence: ConfidenceRow[];
  /** How well guesses fitted on readings with each of the person's tags (idea 3). */
  tagFits: TagFit[];
  /** The person's average fit over every rated guess, or null before enough answers. */
  overallFit: number | null;
  /** Words that keep coming back in the person's notes of signs and dreams (NT1). */
  noteWords: NoteWord[];
}

type GuessFits = Pick<Patterns, "fits" | "confidence" | "tagFits" | "overallFit">;
const NO_FITS: GuessFits = { fits: [], confidence: [], tagFits: [], overallFit: null };

const iso = (d: string | Date) => toISOString(d);

async function loadWhen(userId: number, only: DivinationKind[] | null): Promise<WhenCounts> {
  const rows = await query<{ created_at: string | Date; sky: string | null }>(
    "SELECT created_at, sky FROM divinations WHERE user_id = $1 AND ($2::text[] IS NULL OR kind = ANY($2::text[]))",
    [userId, only]
  );
  return whenCounts(
    rows.map((r) => {
      let sky: SkyFields | null = null;
      if (r.sky) {
        try {
          sky = JSON.parse(r.sky) as SkyFields;
        } catch {
          sky = null;
        }
      }
      return { created_at: iso(r.created_at), sky };
    }),
    MOON_PHASE_ORDER
  );
}

async function loadThemes(userId: number, only: DivinationKind[] | null): Promise<MonthThemes[]> {
  return themesByMonth(await archetypeMonths(userId, only), (slug) => getArchetype(slug)?.name ?? null);
}

async function loadFits(userId: number, only: DivinationKind[] | null): Promise<GuessFits> {
  const scope = "g.user_id = $1 AND d.user_id = $1 AND NOT g.skipped AND g.fit IS NOT NULL AND ($2::text[] IS NULL OR d.kind = ANY($2::text[]))";
  const rows = await query<{ divination_id: number; sealed_at: string | Date; fit: Fit; confidence: Confidence | null }>(
    `SELECT g.divination_id, g.sealed_at, g.fit, g.confidence FROM reading_guesses g JOIN divinations d ON d.id = g.divination_id WHERE ${scope}`,
    [userId, only]
  );
  if (rows.length === 0) return NO_FITS;
  // Tags on those readings: the tarot's own (reading_tags) and every other tool's (divination_tags), always the person's own tags.
  const tags = await query<{ tag: string; fit: Fit }>(
    `SELECT t.name AS tag, g.fit FROM reading_guesses g JOIN divinations d ON d.id = g.divination_id
     JOIN tags t ON t.user_id = $1 AND (
       t.id IN (SELECT dt.tag_id FROM divination_tags dt WHERE dt.divination_id = d.id)
       OR (d.reading_id IS NOT NULL AND t.id IN (SELECT rt.tag_id FROM reading_tags rt WHERE rt.reading_id = d.reading_id)))
     WHERE ${scope}`,
    [userId, only]
  );
  return {
    fits: fitsByMonth(rows.map((r) => ({ sealed_at: iso(r.sealed_at), fit: r.fit }))),
    confidence: confidenceVsFit(rows),
    tagFits: fitByTag(tags),
    overallFit: overallFit(rows.map((r) => r.fit)),
  };
}

/** The person's own notes of signs and dreams, read only to count the words in them; nothing is kept. */
async function loadNoteWords(userId: number, only: DivinationKind[] | null): Promise<NoteWord[]> {
  if (only && !only.includes(NOTE_WORD_KIND)) return [];
  const rows = await query<{ divination_id: number; body: string; created_at: string | Date }>(
    "SELECT n.divination_id, n.body, d.created_at FROM sign_notes n JOIN divinations d ON d.id = n.divination_id WHERE n.user_id = $1 AND d.user_id = $1",
    [userId]
  );
  return recurringNoteWords(rows.map((r) => ({ divination_id: r.divination_id, body: r.body ?? "", created_at: iso(r.created_at) })));
}

export async function loadPatterns(userId: number, only: DivinationKind[] | null): Promise<Patterns> {
  const [when, themes, ownThemes, recurring, shifts, fits, noteWords] = await Promise.all([
    loadWhen(userId, only), loadThemes(userId, only), ownThemeMonths(userId, only), loadRecurring(userId, only), loadShifts(userId, only),
    loadFits(userId, only), loadNoteWords(userId, only),
  ]);
  return { when, themes, ownThemes, recurring, shifts, ...fits, noteWords };
}

export interface HomeThemes {
  /** The shared archetypes that came up most. */
  shared: TopTheme[];
  /** The person's own archetypes and concepts that came up most, counted apart from the shared ones. */
  own: { key: string; name: string; kind: "your archetype" | "your concept"; count: number }[];
}

/** The few themes shown on the home page, for the tools the person is looking at (null for every tool). */
export async function loadHomeThemes(userId: number, only: DivinationKind[] | null): Promise<HomeThemes> {
  const [tallies, own] = await Promise.all([archetypeTalliesFor(userId, only), ownTallies(userId, only)]);
  return {
    shared: topThemes(tallies),
    own: own
      .filter((o) => o.kind !== "shared archetype you linked")
      .slice(0, 3)
      .map((o) => ({ key: o.key, name: o.name, kind: o.kind as "your archetype" | "your concept", count: o.total })),
  };
}
