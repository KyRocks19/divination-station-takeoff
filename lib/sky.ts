import { ZODIAC_ORDER, type ZodiacSign } from "./card-associations";

export type Hemisphere = "north" | "south";

export interface Sky {
  moonPhase: string;
  moonSymbol: string;
  /** Percent of the moon's face that is lit, 0–100. */
  illumination: number;
  /** Days since the last new moon. */
  moonAge: number;
  sunSign: ZodiacSign;
  weekday: string;
  /** Planet that traditionally rules the weekday. */
  dayRuler: string;
  /** Wheel of the Year: the festival most recently passed and the next one. */
  wheelPrevious: string;
  wheelNext: string;
  daysSincePrevious: number;
  daysToNext: number;
  hemisphere: Hemisphere;
  /** IANA time zone the local date was taken in; null means UTC was used. */
  tz: string | null;
}

const SYNODIC_MONTH = 29.530588853;
const REFERENCE_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);
const DAY_MS = 86_400_000;

const MOON_PHASES: [string, string][] = [
  ["New Moon", "🌑"],
  ["Waxing Crescent", "🌒"],
  ["First Quarter", "🌓"],
  ["Waxing Gibbous", "🌔"],
  ["Full Moon", "🌕"],
  ["Waning Gibbous", "🌖"],
  ["Last Quarter", "🌗"],
  ["Waning Crescent", "🌘"],
];

export const MOON_PHASE_ORDER = MOON_PHASES.map(([name]) => name);
export const MOON_SYMBOL: Record<string, string> = Object.fromEntries(MOON_PHASES);

const DAY_RULER: Record<string, string> = {
  Sunday: "Sun",
  Monday: "Moon",
  Tuesday: "Mars",
  Wednesday: "Mercury",
  Thursday: "Jupiter",
  Friday: "Venus",
  Saturday: "Saturn",
};

export const WEEKDAY_ORDER = Object.keys(DAY_RULER);

// First day of each sign as [month, day], in ZODIAC_ORDER (matches the dates in ZODIAC_META).
const SIGN_STARTS: [number, number][] = [
  [3, 21], [4, 20], [5, 21], [6, 22], [7, 23], [8, 23],
  [9, 23], [10, 23], [11, 23], [12, 22], [1, 20], [2, 19],
];

// Northern-hemisphere festival dates as [month, day]. Solstices and equinoxes shift by a day between years.
export const WHEEL_DATES: [number, number][] = [
  [2, 1], [3, 20], [5, 1], [6, 21], [8, 1], [9, 22], [10, 31], [12, 21],
];
export const WHEEL_NAMES = ["Imbolc", "Ostara", "Beltane", "Litha", "Lughnasadh", "Mabon", "Samhain", "Yule"];

function localParts(date: Date, tz: string | null): { year: number; month: number; day: number; weekday: string; tz: string | null } {
  const read = (timeZone: string) => {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, year: "numeric", month: "numeric", day: "numeric", weekday: "long",
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
    return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), weekday: get("weekday") };
  };
  if (tz) {
    try {
      return { ...read(tz), tz };
    } catch {
      // Unknown time zone name — fall through to UTC.
    }
  }
  return { ...read("UTC"), tz: null };
}

function sunSignFor(month: number, day: number): ZodiacSign {
  const value = month * 100 + day;
  // Walk the signs in calendar order starting from Capricorn's tail in January.
  let sign: ZodiacSign = ZODIAC_ORDER[9];
  const calendarOrder = [10, 11, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
  for (const i of calendarOrder) {
    const [m, d] = SIGN_STARTS[i];
    if (value >= m * 100 + d) sign = ZODIAC_ORDER[i];
  }
  return sign;
}

/**
 * Describe the sky at a moment in time. Everything is computed from the date alone, with no outside
 * service: the moon phase is accurate to about half a day, and festival dates to about a day.
 */
export function skyAt(date: Date, opts: { tz?: string | null; hemisphere?: Hemisphere } = {}): Sky {
  const hemisphere: Hemisphere = opts.hemisphere === "south" ? "south" : "north";
  const local = localParts(date, opts.tz ?? null);

  const cycles = (date.getTime() - REFERENCE_NEW_MOON) / DAY_MS / SYNODIC_MONTH;
  const fraction = cycles - Math.floor(cycles);
  const [moonPhase, moonSymbol] = MOON_PHASES[Math.floor(fraction * 8 + 0.5) % 8];

  const today = Date.UTC(local.year, local.month - 1, local.day);
  const festivals: { name: string; at: number }[] = [];
  for (const year of [local.year - 1, local.year, local.year + 1]) {
    WHEEL_DATES.forEach(([m, d], i) => {
      const name = WHEEL_NAMES[hemisphere === "south" ? (i + 4) % 8 : i];
      festivals.push({ name, at: Date.UTC(year, m - 1, d) });
    });
  }
  const previous = festivals.filter((f) => f.at <= today).at(-1)!;
  const next = festivals.find((f) => f.at > today)!;

  return {
    moonPhase,
    moonSymbol,
    illumination: Math.round(((1 - Math.cos(2 * Math.PI * fraction)) / 2) * 100),
    moonAge: Math.round(fraction * SYNODIC_MONTH * 10) / 10,
    sunSign: sunSignFor(local.month, local.day),
    weekday: local.weekday,
    dayRuler: DAY_RULER[local.weekday] ?? "",
    wheelPrevious: previous.name,
    wheelNext: next.name,
    daysSincePrevious: Math.round((today - previous.at) / DAY_MS),
    daysToNext: Math.round((next.at - today) / DAY_MS),
    hemisphere,
    tz: local.tz,
  };
}

/** The sky recorded with a reading, or one computed from its timestamp when none was stored. */
export function readingSky(
  reading: { sky?: string | null; created_at: string | Date },
  hemisphere: Hemisphere = "north"
): Sky & { recorded: boolean } {
  if (reading.sky) {
    try {
      return { ...(JSON.parse(reading.sky) as Sky), recorded: true };
    } catch {
      // Unreadable snapshot — compute instead.
    }
  }
  return { ...skyAt(new Date(reading.created_at), { hemisphere }), recorded: false };
}

/** One-line plain-text description, used in AI context and exports. */
export function describeSky(sky: Sky): string {
  const wheel = sky.daysSincePrevious === 0
    ? sky.wheelPrevious
    : `${sky.daysSincePrevious} days after ${sky.wheelPrevious}, ${sky.daysToNext} before ${sky.wheelNext}`;
  return `${sky.moonPhase} (${sky.illumination}% lit), Sun in ${sky.sunSign.replace(/^\S+\s/, "")}, ${sky.weekday} (day of ${sky.dayRuler}), ${wheel}`;
}
