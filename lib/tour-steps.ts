// The first-run tour and the How this works page share these steps, so they cannot drift apart. Plain, literal words: what each thing does.
// Browser-safe on purpose (no database here): the tour card is a client component.

export interface TourStep {
  title: string;
  body: string;
  /** Where to go to try it, if there is one. */
  link?: { href: string; label: string };
}

export const TOUR_STEPS: TourStep[] = [
  {
    title: "Your own meanings come first",
    body:
      "Nobody here tells you what a card, a stone, a stave, or a swing of the pendulum means. You write what it means to you, in your own words, as many meanings as you like. When you change a meaning, the older wording is kept, so you can see how your sense of it has changed over time.",
  },
  {
    title: "Many tools, and you choose which you see",
    body:
      "Tarot, your own oracle decks, Norse runes, ogham, dice and coins, the I Ching, geomancy, the pendulum, scrying, and pulling words from your own writing all live here, each with the same habit of keeping your words first. Star the tools you use on the home page's tool tiles (Your tools in the menu opens it), and pages start with those. You can make your own sets of cards, stones, or staves, and your own layouts with their own questions.",
    link: { href: "/library", label: "Open the Library" },
  },
  {
    title: "Write about each reading",
    body:
      "After a reading you can write what you noticed first, before you started thinking it through, and mark which words are your thinking mind (a guess or a story) rather than what you sensed. Later you record what did happen, in your own judgement. Nothing is scored or graded.",
    link: { href: "/readings/first", label: "Try a guided first reading" },
  },
  {
    title: "The companion is off until you turn it on",
    body:
      "The companion is an AI that asks you questions using only your own words. It is switched off for everyone at the start. If you turn it on in Settings, you can see the exact words before anything is sent, you can name it, you can tell it what you want from it, and nothing it writes is kept unless you press Keep. It is not a person and it is not crisis support.",
    link: { href: "/settings", label: "Open Settings" },
  },
  {
    title: "Help, colours, and your privacy",
    body:
      "The Feedback button on every page reaches the person who runs the site. Settings holds your colours, your export (everything you wrote, any time), and your choices. Privacy and terms says plainly who can see your writing. You can come back to this at any time from the foot of the home page.",
    link: { href: "/privacy", label: "Read the privacy and terms" },
  },
];
