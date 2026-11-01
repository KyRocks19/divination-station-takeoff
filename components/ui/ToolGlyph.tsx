import type { DivinationKind } from "@/lib/divination-kinds";

interface Props {
  kind: DivinationKind;
  /** The size and placement, for example "h-5 w-5". The picture takes its colour from the text around it. */
  className?: string;
}

// One plain line drawing for each tool, in a box 24 wide and 24 tall. They are drawn in the text colour (`currentColor`),
// so every theme colours them and nothing depends on how a device happens to draw an emoji. The shapes are simple on
// purpose: they say which tool it is, and nothing about what a card, stone or swing means.
const DRAWINGS: Record<DivinationKind, React.ReactNode> = {
  // A card with a four-pointed star.
  tarot: (
    <>
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <path d="M12 8 L13.2 10.8 L16 12 L13.2 13.2 L12 16 L10.8 13.2 L8 12 L10.8 10.8 Z" />
    </>
  ),
  // Two cards, one tilted over the other.
  oracle: (
    <>
      <rect x="4" y="5" width="11" height="16" rx="2" transform="rotate(-12 9.5 13)" />
      <rect x="9" y="3" width="11" height="16" rx="2" transform="rotate(10 14.5 11)" />
      <circle cx="14.5" cy="11" r="1.6" />
    </>
  ),
  // A round dark mirror on a stand, with a glint.
  scrying: (
    <>
      <circle cx="12" cy="10" r="7" />
      <path d="M7.8 8.2 A4.6 4.6 0 0 1 11 5.7" />
      <path d="M12 17 V21 M8.5 21 H15.5" />
    </>
  ),
  // A pendulum hung from a bar: the swung string and weight, and the dotted place where it hangs at rest.
  pendulum: (
    <>
      <path d="M8.5 3 H15.5" />
      <path d="M12 3 L16.8 16.2" />
      <circle cx="17.5" cy="18.2" r="2.2" />
      <circle cx="12" cy="19.2" r="2.2" strokeDasharray="1.2 2" />
    </>
  ),
  // A stone with one rune cut in it.
  runes: (
    <>
      <path d="M12 2.8 C17 2.8 20 6.5 20 12 C20 17.5 17 21.2 12 21.2 C7 21.2 4 17.5 4 12 C4 6.5 7 2.8 12 2.8 Z" />
      <path d="M10 7.5 V16.5 M10 11 L14.5 8 M10 14 L14.5 11" />
    </>
  ),
  // A line with short strokes across it, the way ogham is cut.
  ogham: (
    <>
      <path d="M3 12 H21" />
      <path d="M5 12 V7 M7.5 12 V7 M11 12 V17 M13.5 12 V17 M16 12 V17 M19.5 8 V16" />
    </>
  ),
  // A die seen from a corner.
  dice: (
    <>
      <path d="M12 2.5 L20 7 V17 L12 21.5 L4 17 V7 Z" />
      <path d="M4 7 L12 12 L20 7 M12 12 V21.5" />
      <circle cx="12" cy="7" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="7" cy="13.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="16.2" r="0.9" fill="currentColor" stroke="none" />
      <circle cx="15" cy="13.8" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // A hexagram: six lines, the solid and the broken.
  iching: (
    <path d="M5 4 H19 M5 7.2 H10.5 M13.5 7.2 H19 M5 10.4 H19 M5 13.6 H19 M5 16.8 H10.5 M13.5 16.8 H19 M5 20 H19" />
  ),
  // Four rows of dots, one or two in each, the way a geomantic figure is made.
  geomancy: (
    <>
      <circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="12" cy="15" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="8" cy="20" r="1.5" fill="currentColor" stroke="none" />
      <circle cx="16" cy="20" r="1.5" fill="currentColor" stroke="none" />
    </>
  ),
  // A card with a spade.
  playingcards: (
    <>
      <rect x="5.5" y="2.5" width="13" height="19" rx="2" />
      <path d="M12 7 C15 10 16 11.5 16 13 A2 2 0 0 1 12.6 14.2 C12.8 15.4 13.2 16.2 14 17 H10 C10.8 16.2 11.2 15.4 11.4 14.2 A2 2 0 0 1 8 13 C8 11.5 9 10 12 7 Z" />
    </>
  ),
  // A round charm with a hole for a cord, and a short cord.
  charms: (
    <>
      <circle cx="12" cy="14" r="6.5" />
      <circle cx="12" cy="9.5" r="1.3" />
      <path d="M12 8.2 V3 M9.5 3 H14.5 M9 15.5 L15 15.5" />
    </>
  ),
  // A crescent moon and a small star.
  signs: (
    <>
      <path d="M16.5 14.5 A7 7 0 1 1 9.5 4.5 A5.5 5.5 0 0 0 16.5 14.5 Z" />
      <path d="M18 5 L18.7 6.6 L20.3 7.3 L18.7 8 L18 9.6 L17.3 8 L15.7 7.3 L17.3 6.6 Z" />
    </>
  ),
  // A cup seen from the side, with a few leaves at the bottom.
  tea: (
    <>
      <path d="M4 8 H18 V12 A7 7 0 0 1 11 19 A7 7 0 0 1 4 12 Z" />
      <path d="M18 9 H19.5 A2.5 2.5 0 0 1 19.5 14 H17.6" />
      <path d="M8 15.5 L9.6 14.4 M11 16.5 L12.8 15.6 M9.5 17.6 L11 17.2" />
    </>
  ),
  // A blot pressed from a fold: two mirrored drops either side of a centre line.
  blots: (
    <>
      <path d="M12 4 V20" />
      <path d="M11 7 C7 6 4 9 5.5 12 C4 15 7 18.5 11 16.5 M13 7 C17 6 20 9 18.5 12 C20 15 17 18.5 13 16.5" />
    </>
  ),
  // An eye.
  remoteview: (
    <>
      <path d="M2.5 12 C5.5 7 9 5.5 12 5.5 C15 5.5 18.5 7 21.5 12 C18.5 17 15 18.5 12 18.5 C9 18.5 5.5 17 2.5 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // An open book.
  bibliomancy: (
    <>
      <path d="M12 6.5 C9.5 4.8 6 4.6 3 5.6 V18.6 C6 17.6 9.5 17.8 12 19.5 C14.5 17.8 18 17.6 21 18.6 V5.6 C18 4.6 14.5 4.8 12 6.5 Z" />
      <path d="M12 6.5 V19.5 M6 9 H9 M6 12 H9 M15 9 H18 M15 12 H18" />
    </>
  ),
};

/**
 * The drawn picture for a tool: the tiles on the home page, the rows of the side navigation, and the headings that name a
 * tool. It is a decoration, hidden from screen readers (the tool's name is always written beside it). It replaces the
 * emoji the app used before, which looked different on every device and could not follow a theme's colours.
 */
export default function ToolGlyph({ kind, className = "h-5 w-5" }: Props) {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {DRAWINGS[kind]}
    </svg>
  );
}
