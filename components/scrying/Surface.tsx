import { useId } from "react";
import { SCRYING_SURFACE_LABELS, type ScryingSurface } from "@/lib/scrying-surfaces";
import Styled from "@/components/ui/Styled";

interface Props {
  surface: ScryingSurface;
  /** Slow movement inside the surface. Off for the small pictures in lists. */
  moving?: boolean;
  className?: string;
}

// The colour of the soft shapes that drift inside each surface. They stay faint on purpose.
const TINT: Record<ScryingSurface, string> = {
  mirror: "#b9b3d9",
  ball: "#b49cf0",
  water: "#7fc4d6",
};

// The middle of each surface's glass, where it is lightest.
const GLASS: Record<ScryingSurface, string> = {
  mirror: "#11101f",
  ball: "#241d44",
  water: "#0a1a22",
};

/**
 * A scrying surface, drawn by the app: a dark mirror, a crystal ball on a stand, or a bowl of water seen from
 * above. The movement is slow and low in contrast and never flashes; the classes that move it are in
 * app/globals.css, which also keeps everything still when the device asks for reduced motion.
 * The picture shows nothing on purpose. What a person sees in it is theirs.
 */
export default function Surface({ surface, moving = true, className = "" }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const move = (name: string) => (moving ? `scry-move ${name}` : undefined);
  const tint = TINT[surface];
  const ball = surface === "ball";
  // The dark part a person looks into: its middle and its radius.
  const cx = 100;
  const cy = ball ? 92 : 100;
  const r = surface === "mirror" ? 88 : 78;

  return (
    <svg viewBox="0 0 200 200" role="img" aria-label={SCRYING_SURFACE_LABELS[surface]} className={className}>
      <defs>
        <radialGradient id={`${uid}-glass`} cx={ball ? "38%" : "50%"} cy={ball ? "32%" : "50%"} r="75%">
          <stop offset="0%" stopColor={GLASS[surface]} />
          <stop offset="70%" stopColor="#07070f" />
          <stop offset="100%" stopColor="#030306" />
        </radialGradient>
        <radialGradient id={`${uid}-mist`}>
          <stop offset="0%" stopColor={tint} stopOpacity="0.17" />
          <stop offset="60%" stopColor={tint} stopOpacity="0.05" />
          <stop offset="100%" stopColor={tint} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${uid}-clip`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>

      {/* What holds the surface: the mirror's frame, the bowl's rim, or the ball's stand. */}
      {ball ? (
        <>
          <ellipse cx="100" cy="186" rx="46" ry="8" fill="#141122" />
          <path d="M68 184 L76 158 H124 L132 184 Z" fill="#1c182b" stroke="#3a3157" strokeWidth="1.5" />
        </>
      ) : (
        <circle cx="100" cy="100" r="94" fill={surface === "water" ? "#221d33" : "#1c182b"} stroke="#3a3157" strokeWidth="2" />
      )}

      <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-glass)`} />

      <g clipPath={`url(#${uid}-clip)`}>
        <ellipse className={move("scry-drift-a")} cx={cx - 22} cy={cy - 14} rx="62" ry="44" fill={`url(#${uid}-mist)`} />
        <ellipse className={move("scry-drift-b")} cx={cx + 26} cy={cy + 20} rx="54" ry="60" fill={`url(#${uid}-mist)`} />
        <ellipse className={move("scry-drift-c")} cx={cx} cy={cy + 4} rx="40" ry="34" fill={`url(#${uid}-mist)`} />
        {surface === "water" && (
          <>
            {/* Two rings that never move, so still water also reads as water. */}
            <circle cx={cx} cy={cy} r="30" fill="none" stroke={tint} strokeOpacity="0.05" strokeWidth="1" />
            <circle cx={cx} cy={cy} r="56" fill="none" stroke={tint} strokeOpacity="0.04" strokeWidth="1" />
            {moving &&
              [0, -7, -14].map((delay) => (
                <Styled
                  as="circle"
                  key={delay}
                  className="scry-move scry-ripple"
                  css={{ animationDelay: `${delay}s` }}
                  cx={cx}
                  cy={cy}
                  r="74"
                  fill="none"
                  stroke={tint}
                  strokeWidth="1"
                  opacity="0"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </>
        )}
      </g>

      {/* A faint highlight that never moves, so the mirror and the ball read as glass. */}
      {surface === "mirror" && (
        <path d="M38 66 A72 72 0 0 1 92 30" fill="none" stroke="#ffffff" strokeOpacity="0.06" strokeWidth="3" strokeLinecap="round" />
      )}
      {ball && <ellipse cx="72" cy="58" rx="20" ry="10" transform="rotate(-35 72 58)" fill="#ffffff" fillOpacity="0.07" />}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#4a4070" strokeOpacity="0.5" strokeWidth="1" />
    </svg>
  );
}
