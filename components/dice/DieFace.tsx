import { faceLabel, sideShape, type DiceObjectId } from "@/lib/dice-data";

interface Props {
  object: DiceObjectId;
  /** The face that came up, as plain text: "heads", "tails", "a" to "d" for a knucklebone, or the number. */
  face: string;
  className?: string;
}

// The outline of each object, in a box 100 wide and 100 tall.
const OUTLINE: Record<DiceObjectId, string> = {
  coin: "",
  knucklebone: "",
  d4: "50,10 92,86 8,86",
  d6: "",
  d8: "50,6 92,50 50,94 8,50",
  d10: "50,6 90,38 74,92 26,92 10,38",
  d12: "50,6 92,36 76,88 24,88 8,36",
  d20: "50,6 90,28 90,72 50,94 10,72 10,28",
  d100: "",
};

/**
 * One face that came up: the object's outline, drawn by the app, with the number or "Heads" or "Tails" inside.
 * The shapes are plain outlines, not exact pictures of each solid or of a bone. Nothing moves.
 */
export default function DieFace({ object, face, className = "" }: Props) {
  const label = faceLabel(face);
  const outline = OUTLINE[object];
  // A knucklebone shows only the letter of its side inside the shape; the full name is the picture's label.
  const inside = object === "knucklebone" ? face.toUpperCase() : label;
  const long = inside.length > 2;
  return (
    <svg
      viewBox="0 0 100 100"
      className={className}
      role="img"
      aria-label={object === "coin" ? label : object === "knucklebone" ? `${label}, ${sideShape(face) ?? ""}` : `${object}, ${label}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={4}
      strokeLinejoin="round"
    >
      {object === "coin" || object === "d100" ? (
        <circle cx="50" cy="50" r="42" />
      ) : object === "knucklebone" ? (
        <path d="M28 12 H72 C84 12 88 24 82 38 C78 46 78 54 82 62 C88 76 84 88 72 88 H28 C16 88 12 76 18 62 C22 54 22 46 18 38 C12 24 16 12 28 12 Z" />
      ) : object === "d6" ? (
        <rect x="10" y="10" width="80" height="80" rx="14" />
      ) : (
        <polygon points={outline} />
      )}
      <text
        x="50"
        y={object === "d4" ? 68 : 58}
        textAnchor="middle"
        fontSize={long ? 22 : inside.length === 2 ? 34 : 40}
        fill="currentColor"
        stroke="none"
        fontFamily="inherit"
      >
        {inside}
      </text>
    </svg>
  );
}
