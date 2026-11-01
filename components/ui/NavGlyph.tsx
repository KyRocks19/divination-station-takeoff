// One plain line drawing for each link in the navigation that is not a tool (the tools have ToolGlyph). Same box (24 by 24), same line, drawn in the
// text colour so every theme colours them. They only say which page it is: a book for Journals, an envelope for feedback. They are a decoration:
// the name is always written beside them. Open item T16 (they replace emoji, which look different on every device).
const DRAWINGS: Record<string, React.ReactNode> = {
  // A sheet with a folded corner and lines of writing.
  readings: (
    <>
      <path d="M6 2.5 H14.5 L19 7 V21.5 H6 Z" />
      <path d="M14.5 2.5 V7 H19" />
      <path d="M9 11 H16 M9 14.5 H16 M9 18 H13" />
    </>
  ),
  // An open book.
  journals: (
    <>
      <path d="M12 6.5 C9.5 4.5 6 4.3 3 5 V19 C6 18.3 9.5 18.5 12 20.5 C14.5 18.5 18 18.3 21 19 V5 C18 4.3 14.5 4.5 12 6.5 Z" />
      <path d="M12 6.5 V20.5" />
    </>
  ),
  // A calendar page with two rings and one marked day.
  days: (
    <>
      <rect x="3.5" y="5" width="17" height="16" rx="2" />
      <path d="M3.5 10 H20.5 M8 3 V6.5 M16 3 V6.5" />
      <circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none" />
    </>
  ),
  // Points joined by lines, the way stars are joined.
  patterns: (
    <>
      <path d="M5 16 L10 8 L15 13 L19.5 5.5" />
      <circle cx="5" cy="16" r="1.6" />
      <circle cx="10" cy="8" r="1.6" />
      <circle cx="15" cy="13" r="1.6" />
      <circle cx="19.5" cy="5.5" r="1.6" />
    </>
  ),
  // An eye looking ahead.
  predictions: (
    <>
      <path d="M2.5 12 C5.5 7 9 5.5 12 5.5 C15 5.5 18.5 7 21.5 12 C18.5 17 15 18.5 12 18.5 C9 18.5 5.5 17 2.5 12 Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  // A question mark beside a second, smaller one: the same question asked again.
  questions: (
    <>
      <path d="M5 8.5 C5 5.5 7 4 9.5 4 C12 4 14 5.5 14 8 C14 10.5 11.5 11 10 12.5 V14.5" />
      <circle cx="10" cy="18.5" r="1.2" fill="currentColor" stroke="none" />
      <path d="M16 12 C16 10.5 17 9.5 18.3 9.5 C19.6 9.5 20.5 10.4 20.5 11.6 C20.5 13 19 13.3 18.3 14.2 V15.3" />
      <circle cx="18.3" cy="18.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // Three named places of different sizes, as in a layout.
  layouts: (
    <>
      <rect x="3.5" y="3.5" width="9" height="12" rx="1.5" />
      <rect x="15" y="3.5" width="5.5" height="7" rx="1.5" />
      <rect x="15" y="13" width="5.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="18" width="9" height="2.5" rx="1" />
    </>
  ),
  // Three books standing on a shelf.
  library: (
    <>
      <rect x="4" y="5" width="4" height="14" rx="1" />
      <rect x="10" y="3.5" width="4" height="15.5" rx="1" />
      <path d="M17 19 L20.5 7.5 L16.7 6.3 L13.3 17.8" />
      <path d="M3 21 H21" />
    </>
  ),
  // Two sheets, one behind the other, with a line of writing and a marker.
  sources: (
    <>
      <path d="M8 3.5 H19 V17" />
      <rect x="4.5" y="6.5" width="11.5" height="14" rx="1.5" />
      <path d="M7.5 11 H13 M7.5 14 H13 M7.5 17 H10.5" />
    </>
  ),
  // Two speech bubbles.
  forum: (
    <>
      <path d="M3.5 5 H15 V13 H8.5 L5.5 16 V13 H3.5 Z" />
      <path d="M17.5 9 H20.5 V17 H18.5 V20 L15.5 17 H10.5 V14.5" />
    </>
  ),
  // A sealed envelope: the flap closed, with a round seal where it meets.
  letters: (
    <>
      <rect x="3" y="6" width="18" height="12.5" rx="1.5" />
      <path d="M3.5 6.8 L10.2 12 M20.5 6.8 L13.8 12" />
      <circle cx="12" cy="12.6" r="1.9" />
    </>
  ),
  // Three people close together.
  circle: (
    <>
      <circle cx="12" cy="6.5" r="2.4" />
      <circle cx="5.8" cy="16.5" r="2.4" />
      <circle cx="18.2" cy="16.5" r="2.4" />
      <path d="M9.6 8.5 L7 14.4 M14.4 8.5 L17 14.4 M8.2 17.2 H15.8" />
    </>
  ),
  // A question mark in a circle.
  guide: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.3 9.6 C9.5 7.6 11 6.8 12.2 6.8 C13.8 6.8 14.9 7.9 14.9 9.3 C14.9 11.4 12.2 11.5 12.2 13.6" />
      <circle cx="12.2" cy="16.9" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  // An envelope.
  feedback: (
    <>
      <rect x="3" y="5.5" width="18" height="13" rx="2" />
      <path d="M3.5 7 L12 13 L20.5 7" />
    </>
  ),
  // A crescent moon.
  about: <path d="M19.5 14.5 A8.5 8.5 0 1 1 9.5 4.5 A6.8 6.8 0 0 0 19.5 14.5 Z" />,
  // Two heads and shoulders.
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3.5 20 C3.5 15.5 6 13.5 9 13.5 C12 13.5 14.5 15.5 14.5 20" />
      <path d="M15.5 5.5 A3 3 0 0 1 15.5 11.3 M17.5 13.8 C19.7 14.4 20.8 16.5 20.8 20" />
    </>
  ),
  // A flag on a pole.
  reports: (
    <>
      <path d="M6 21.5 V3" />
      <path d="M6 4.5 H18 L15.5 8.5 L18 12.5 H6" />
    </>
  ),
  // A pentacle: a five-pointed star inside a circle.
  admin: (
    <>
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 3 L17.3 20 L3.2 9.1 H20.8 L6.7 20 Z" />
    </>
  ),
  // A screen on a stand.
  workers: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="1.8" />
      <path d="M9 20.5 H15 M12 16 V20.5" />
    </>
  ),
  // A clipboard with ticked lines.
  adminlog: (
    <>
      <rect x="5" y="4.5" width="14" height="17" rx="2" />
      <path d="M9 3 H15 V6.5 H9 Z" />
      <path d="M8.5 11.5 L9.7 12.7 L11.7 10.4 M13.5 11.5 H16 M8.5 16.5 L9.7 17.7 L11.7 15.4 M13.5 16.5 H16" />
    </>
  ),
  // A house with a lit door.
  host: (
    <>
      <path d="M3.5 11 L12 4 L20.5 11" />
      <path d="M5.5 9.5 V20.5 H18.5 V9.5" />
      <path d="M10 20.5 V15 H14 V20.5" />
    </>
  ),
};

// One drawing for each heading that folds (the keys of NAV_FOLD_KEYS in lib/nav-groups.ts), so that in the narrow menu,
// where only pictures show, the folded groups can be told apart (owner's request, 2026-10-26), and one for the Your tools
// link. Admin's heading shows the key on the left and the pentacle from DRAWINGS after the word (owner's request, 2026-10-26).
const GROUP_DRAWINGS: Record<string, React.ReactNode> = {
  // A bundle of tools: a drawstring pouch with a wand and a card standing out of it.
  tools: (
    <>
      <path d="M6.5 11 C4 14 4.5 20.5 12 20.5 C19.5 20.5 20 14 17.5 11 Z" />
      <path d="M5.5 11 H18.5" />
      <path d="M9 11 L6.5 3.5" />
      <path d="M11.5 11 V5 H16 V11" />
      <path d="M12 15.5 L12.6 16.4 L13.6 16.6 L12.8 17.3 L13 18.3 L12 17.8 L11 18.3 L11.2 17.3 L10.4 16.6 L11.4 16.4 Z" />
    </>
  ),
  // An old key.
  admin: (
    <>
      <circle cx="7" cy="12" r="3.8" />
      <circle cx="7" cy="12" r="1.3" />
      <path d="M10.8 12 H21 M17.5 12 V15.5 M20.5 12 V14.5" />
    </>
  ),
  // A quill pen.
  writing: (
    <>
      <path d="M20 3.5 C12.5 4.5 7.5 9.5 6 17 H8.5 C14.5 15.5 18.5 10.5 20 3.5 Z" />
      <path d="M3.5 20.5 L13 11" />
    </>
  ),
  // An hourglass.
  recent: (
    <>
      <path d="M6 3.5 H18 M6 20.5 H18" />
      <path d="M7.5 3.5 C7.5 8 10.5 10 12 12 C13.5 10 16.5 8 16.5 3.5 M7.5 20.5 C7.5 16 10.5 14 12 12 C13.5 14 16.5 16 16.5 20.5" />
    </>
  ),
  // Two people side by side.
  people: (
    <>
      <circle cx="8" cy="8.5" r="2.6" />
      <circle cx="16" cy="8.5" r="2.6" />
      <path d="M3.5 20 C3.5 15.5 5.5 13.5 8 13.5 C10.5 13.5 12 15 12 17 C12 15 13.5 13.5 16 13.5 C18.5 13.5 20.5 15.5 20.5 20" />
    </>
  ),
  // A lit candle.
  learn: (
    <>
      <path d="M12 3 C14 5.5 14.5 7 12 9 C9.5 7 10 5.5 12 3 Z" />
      <rect x="9" y="11" width="6" height="10" rx="1" />
      <path d="M12 9 V11 M6.5 21 H17.5" />
    </>
  ),
  // A signpost with a sign pointing each way.
  help: (
    <>
      <path d="M12 3 V21 M8.5 21 H15.5" />
      <path d="M12 5 H18.5 L20.5 7 L18.5 9 H12 M12 11.5 H5.5 L3.5 13.5 L5.5 15.5 H12" />
    </>
  ),
};

/** Whether this item has a drawn picture (otherwise the caller shows the emoji it has in lib/nav-groups.ts). */
export const hasNavGlyph = (id: string) => id in DRAWINGS;

/**
 * The drawn picture for a navigation item, or with `group` for a heading that folds; null when it has none. The size and
 * place come from `className`; it takes the text colour.
 */
export default function NavGlyph({ id, group = false, className = "h-5 w-5" }: { id: string; group?: boolean; className?: string }) {
  const drawing = (group ? GROUP_DRAWINGS[id] : undefined) ?? DRAWINGS[id];
  if (!drawing) return null;
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
      {drawing}
    </svg>
  );
}
