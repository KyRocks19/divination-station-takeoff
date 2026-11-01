import type { DivinationKind } from "./divination-kinds";

// Where each tool began, as far as anyone can tell, for the world map on the home page. Each entry was checked against the
// sources listed with it on 2026-10-12 (the sources differ on some dates, and the notes say where). A tool whose origin
// is not one place is marked "uncertain" and shown with a dashed ring. This file touches no database code, so screens that
// run in the browser can import it. A new tool adds an entry here; a tool with no entry is still listed under the map.

export type Certainty = "documented" | "disputed" | "uncertain";

export const CERTAINTY_LABELS: Record<Certainty, string> = {
  documented: "Well documented",
  disputed: "Parts of this are disputed",
  uncertain: "Origin uncertain",
};

export interface OriginSource {
  title: string;
  url: string;
}

export interface ToolOrigin {
  id: string;
  /** Which tool this point opens. */
  kind: DivinationKind;
  /** What the point is called on the map: usually the tool, or the part of it (dice, coins). */
  label: string;
  /** The place, in plain words. */
  place: string;
  /** About when, in plain words. */
  when: string;
  lon: number;
  lat: number;
  certainty: Certainty;
  /** A short plain note: what is known, what is disputed, and how divination use relates to it. */
  note: string;
  sources: OriginSource[];
}

export const TOOL_ORIGINS: ToolOrigin[] = [
  {
    id: "tarot",
    kind: "tarot",
    label: "Tarot",
    place: "Northern Italy (Milan and Ferrara)",
    when: "the 1440s",
    lon: 10.4,
    lat: 45.15,
    certainty: "documented",
    note: "The first written mention is from Ferrara in 1442, and the oldest surviving decks were painted for the Visconti court in Milan. Tarot began as a card game. Using it to divine began in France in the 1780s.",
    sources: [
      { title: "Visconti-Sforza Tarot Cards (Morgan Library)", url: "https://www.themorgan.org/manuscript/158525" },
      { title: "Early tarot, 1420 to 1475 (Tarot Heritage)", url: "https://tarot-heritage.com/history-4/early-tarot-1420-1475/" },
      { title: "Etteilla (Wikipedia)", url: "https://en.wikipedia.org/wiki/Etteilla" },
    ],
  },
  {
    id: "runes",
    kind: "runes",
    label: "Runes",
    place: "Southern Scandinavia (the Vimose comb, Funen, Denmark)",
    when: "about 160 CE, the earliest secure finds",
    lon: 10.4,
    lat: 55.4,
    certainty: "disputed",
    note: "A spearhead from southern Norway of about the same date is the other early find. Where the script itself came from is disputed: Greek, Latin, and north Italic alphabets have all been proposed. Using runes to divine, with a set meaning for each rune, is modern.",
    sources: [
      { title: "Runes (World History Encyclopedia)", url: "https://www.worldhistory.org/runes/" },
      { title: "The origins of the runes (norse-mythology.org)", url: "https://norse-mythology.org/runes/the-origins-of-the-runes/" },
    ],
  },
  {
    id: "ogham",
    kind: "ogham",
    label: "Ogham",
    place: "South-west Ireland (counties Cork and Kerry)",
    when: "about the 4th century CE",
    lon: -9.6,
    lat: 52,
    certainty: "disputed",
    note: "About 60 percent of the roughly 400 surviving stones are in Cork and Kerry; the next largest group is in Pembrokeshire, Wales. Some scholars argue for an earlier start, and the letters' sounds show use before the stones. Divining with ogham is mostly 20th century.",
    sources: [{ title: "Ogham (Wikipedia)", url: "https://en.wikipedia.org/wiki/Ogham" }],
  },
  {
    id: "dice",
    kind: "dice",
    label: "Dice",
    place: "Shahr-i Sokhta (the Burnt City), south-eastern Iran",
    when: "about 2800 to 2500 BCE",
    lon: 61.4,
    lat: 30.6,
    certainty: "documented",
    note: "The oldest known made dice, found in a grave with a board game. Knucklebones, thrown before cube dice, are older still. Whether dice were first for games or for divination cannot now be said.",
    sources: [{ title: "Dice (Wikipedia)", url: "https://en.wikipedia.org/wiki/Dice" }],
  },
  {
    id: "coins",
    kind: "dice",
    label: "Coins",
    place: "Lydia (Sardis and Ephesus), western Turkey",
    when: "the 7th century BCE; sources give about 650 to 600 BCE",
    lon: 28,
    lat: 38.4,
    certainty: "documented",
    note: "The first coins were electrum, a natural mix of gold and silver. One timeline puts the first coins on Aegina about 700 BCE, which most sources do not. Tossing a coin to divine has no firm early record in the sources checked.",
    sources: [
      { title: "Early Lydian coinage and chronology (Austrian Academy of Sciences)", url: "https://www.oeaw.ac.at/en/oeai/research/classical-studies/numismatics/early-lydian-coinage-and-chronology" },
    ],
  },
  {
    id: "scrying",
    kind: "scrying",
    label: "Scrying",
    place: "Mesopotamia (Babylonia), the oldest traced bowl divination",
    when: "ancient times, with no firm date",
    lon: 44.4,
    lat: 32.5,
    certainty: "uncertain",
    note: "Reading oil on water in a bowl is traced to Babylonia, though it is mentioned in only one text. Looking into water, mirrors, and crystal grew in many cultures, and crystal gazing came much later (John Dee, in the 1500s), so this is the oldest point found, not the only one.",
    sources: [
      { title: "Lecanomancy (Wikipedia)", url: "https://en.wikipedia.org/wiki/Lecanomancy" },
      { title: "Arabic bowl divination and the Greek magical papyri (Fodor)", url: "https://arabist.hu/volumes/volume-9-10/alexander-fodor-1994/" },
    ],
  },
  {
    id: "pendulum",
    kind: "pendulum",
    label: "Pendulum",
    place: "Germany (the mining regions), uncertain",
    when: "dowsing for metals is documented from the 1400s; older claims are weak",
    lon: 13,
    lat: 50.7,
    certainty: "uncertain",
    note: "Dowsing with a rod or a swinging weight is documented in 15th-century Germany, where it was used to find metals. A ring on a thread used as an oracle is described by a Roman historian in the 4th century CE, but that is a related practice. The chemist Chevreul wrote about the pendulum's movements in 1833.",
    sources: [
      { title: "Dowsing and the pendulum (Center for Inquiry)", url: "https://cdn.centerforinquiry.org/wp-content/uploads/sites/29/2001/07/22164826/p35.pdf" },
    ],
  },
  {
    id: "oracle",
    kind: "oracle",
    label: "Oracle Deck",
    place: "Paris and German lands, where decks made only for divination were printed",
    when: "the 1780s to the 1850s",
    lon: 2.35,
    lat: 48.85,
    certainty: "documented",
    note: "Etteilla published a deck for divination in 1789 and 1790, and the Lenormand decks followed in the 1840s and 1850s. Your own deck is made by you, anywhere, so this marks the printed tradition it grew out of.",
    sources: [
      { title: "Etteilla (Wikipedia)", url: "https://en.wikipedia.org/wiki/Etteilla" },
      { title: "Oracle decks (Etteilla archive)", url: "https://new.etteilla.org/en/archetypes/oracle-decks/" },
    ],
  },
  {
    id: "iching",
    kind: "iching",
    label: "I Ching",
    place: "The Zhou kingdom (the Wei river valley, near present-day Xi'an, China)",
    when: "about the 9th century BCE for the Zhou yi; scholars' dates run from the 10th to the 4th century BCE",
    lon: 108.9,
    lat: 34.3,
    certainty: "disputed",
    note: "The Zhou yi, the core of the I Ching, is a divination text of the Western Zhou. Edward Shaughnessy dates its making to the last quarter of the 9th century BCE; others place it later. Bamboo slips show it in use by about 300 BCE, and the Zuo zhuan records divinations by it from 671 BCE. The attributions to King Wen, the Duke of Zhou and Confucius are no longer generally accepted, and the point is the Zhou realm, not a known town.",
    sources: [
      { title: "I Ching (Wikipedia)", url: "https://en.wikipedia.org/wiki/I_Ching" },
      { title: "I Ching divination (Wikipedia)", url: "https://en.wikipedia.org/wiki/I_Ching_divination" },
      { title: "The Yi King, trans. James Legge, 1882 (Sacred Texts)", url: "https://www.sacred-texts.com/ich/index.htm" },
    ],
  },
  {
    id: "geomancy",
    kind: "geomancy",
    label: "Geomancy",
    place: "The Arabic-speaking world: no single place is known (the point marks the middle of Arabia)",
    when: "Arabic texts by about the 9th century CE; Latin translations in 12th-century Spain",
    lon: 45,
    lat: 24,
    certainty: "uncertain",
    note: "Geomancy takes its name from the Arabic 'ilm al-raml, the science of the sand. An Arabic origin is judged most likely, but no place or date is firm: the legends that credit Idris or Hermes are legends. Hugh of Santalla's Latin Ars geomantiae of the early 12th century and Gerard of Cremona's translations carried it into Europe. The related figures of West Africa and Madagascar have their own histories.",
    sources: [
      { title: "Arabic geomancy (Wikipedia)", url: "https://en.wikipedia.org/wiki/Arabic_geomancy" },
      { title: "Geomancy (Wikipedia)", url: "https://en.wikipedia.org/wiki/Geomancy" },
    ],
  },
  {
    id: "bibliomancy",
    kind: "bibliomancy",
    label: "Bibliomancy",
    place: "Rome and the Roman world",
    when: "perhaps as early as the 2nd century CE; the Roman accounts were written down later",
    lon: 12.5,
    lat: 41.9,
    certainty: "disputed",
    note: "The Roman sortes opened a trusted book at random: Homer, Virgil, later the Bible. Stories of emperors Hadrian and Alexander Severus drawing a line from Virgil are the best known, and the practice 'may date to as early as the second century AD'. The Persian falnama, books of omens, and the use of the Quran or the Divan of Hafez are other, later forms. Opening your own past writing is this app's change, not an old practice.",
    sources: [
      { title: "Bibliomancy (Wikipedia)", url: "https://en.wikipedia.org/wiki/Bibliomancy" },
      { title: "Sortes Vergilianae (Wikipedia)", url: "https://en.wikipedia.org/wiki/Sortes_Vergilianae" },
    ],
  },
  // Added 2026-10-29, when tea leaves and ink blots became two tools.
  {
    id: "tea",
    kind: "tea",
    label: "Tasseomancy",
    place: "Britain, where the oldest handbooks found were written",
    when: "the late 1800s for the handbooks; any earlier start has no firm date",
    lon: -2.5,
    lat: 54,
    certainty: "uncertain",
    note: "Reading tea leaves is often said to have begun in China, 'likely soon after the creation of tea', but no date or record is given for that. Western readers are linked to older European ways of reading spilled wax and molten lead, and reading the grounds of coffee is told of in the Ottoman world. The firm record is later: it grew popular as a parlour game in Britain in the late 1800s, when many of the shape meanings still used were set down, and handbooks such as one signed 'a Highland Seer' taught how to brew, drain and turn the cup.",
    sources: [
      { title: "Tasseography (Wikipedia)", url: "https://en.wikipedia.org/wiki/Tasseography" },
      { title: "Tea-Cup Reading, by a Highland Seer (Project Gutenberg)", url: "https://www.gutenberg.org/ebooks/18241" },
    ],
  },
  {
    id: "blots",
    kind: "blots",
    label: "Inkblots",
    place: "Weinsberg, Germany (Justinus Kerner); later Switzerland (Hermann Rorschach)",
    when: "1857 for Kerner's book; 1921 for Rorschach's test",
    lon: 9.29,
    lat: 49.15,
    certainty: "disputed",
    note: "The poet and doctor Justinus Kerner, losing his sight, began dropping blots of ink on paper and turning them into pictures for his poems: Klecksographien, 1857. Hermann Rorschach loved the pastime as a boy in Switzerland and built his inkblot test from it (Psychodiagnostik, 1921). Seeing shapes in chance marks is far older; the idea is traced back as far as Leonardo da Vinci. Ink blots were a pastime and a psychological test, not a divination tradition; reading one for yourself is this app's use.",
    sources: [
      { title: "Klecksography (Wikipedia)", url: "https://en.wikipedia.org/wiki/Klecksography" },
      { title: "Rorschach test (Wikipedia)", url: "https://en.wikipedia.org/wiki/Rorschach_test" },
    ],
  },
];
