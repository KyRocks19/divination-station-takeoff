import { PORCELAIN, getTea, type TeaKind } from "@/lib/tea-core";
import type { RevealScene as Scene } from "@/lib/reveal-core";
import ShuffleDeck from "@/components/ShuffleDeck";

/**
 * The moving picture while a reading opens (components/reveal/Reveal.tsx). Drawn in the text colour except the tea, which is the colour of
 * the tea the person chose. The movement is in app/globals.css (the rv-* classes) and stops for anyone who asked for less motion; the
 * picture still shows. `still` draws it without movement, for a covered reading.
 */
export default function RevealScene({ scene, tea = null, still = false, className = "" }: { scene: Scene; tea?: TeaKind | null; still?: boolean; className?: string }) {
  const move = (c: string) => (still ? "" : c);
  // Cards (tarot, oracle, playing cards) shuffle as the five sigil card backs of the draw (owner's request, 2026-11-01).
  if (scene === "shuffle") return <ShuffleDeck still={still} className={still ? className : `${className} min-h-[260px]`} />;
  return (
    <svg viewBox="0 0 200 200" aria-hidden="true" className={`text-tone-300 ${className}`}>
      {scene === "brew" && <Brew tea={tea ?? "china-black"} move={move} />}
      {scene === "ink" && (
        <g>
          <rect x="30" y="40" width="140" height="120" rx="4" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeOpacity="0.4" />
          <line x1="100" y1="40" x2="100" y2="160" stroke="currentColor" strokeOpacity="0.3" strokeDasharray="3 4" />
          <circle cx="100" cy="100" r="34" fill="currentColor" fillOpacity="0.85" className={`rv-origin ${move("rv-spread")}`} />
          <circle cx="78" cy="78" r="9" fill="currentColor" fillOpacity="0.8" className={`rv-origin ${move("rv-spread rv-late")}`} />
          <circle cx="122" cy="78" r="9" fill="currentColor" fillOpacity="0.8" className={`rv-origin ${move("rv-spread rv-late")}`} />
        </g>
      )}
      {scene === "bag" && (
        <g>
          <g className={`rv-origin-bottom ${move("rv-wobble")}`}>
            <path d="M62 80c-14 30-10 70 38 72 48-2 52-42 38-72z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="2.5" />
            <path d="M66 80c10-8 58-8 68 0" fill="none" stroke="currentColor" strokeWidth="2.5" />
            <path d="M90 74c-4-10 2-16 10-16s14 6 10 16" fill="none" stroke="currentColor" strokeWidth="2" />
          </g>
          {[0, 1, 2].map((i) => (
            <ellipse key={i} cx={84 + i * 16} cy="70" rx="7" ry="5" fill="currentColor" fillOpacity="0.7" className={move(`rv-hop rv-hop-${i}`)} />
          ))}
        </g>
      )}
      {scene === "tumble" && (
        <g>
          {[0, 1].map((i) => (
            <g key={i} className={`rv-origin ${move(`rv-tumble rv-tumble-${i}`)}`}>
              <rect x={60 + i * 50} y={80} width="36" height="36" rx="7" className="fill-surface" stroke="currentColor" strokeWidth="2.5" />
              {(i === 0 ? [[78, 98]] : [[120, 88], [138, 108]]).map(([x, y], k) => (
                <circle key={k} cx={x} cy={y} r="3.5" fill="currentColor" />
              ))}
            </g>
          ))}
          <line x1="40" y1="140" x2="160" y2="140" stroke="currentColor" strokeOpacity="0.3" />
        </g>
      )}
      {scene === "coins" && (
        <g>
          {[0, 1, 2].map((i) => (
            <g key={i} className={`rv-origin ${move(`rv-flip rv-flip-${i}`)}`}>
              <circle cx={55 + i * 45} cy="100" r="18" className="fill-surface" stroke="currentColor" strokeWidth="2.5" />
              <rect x={49 + i * 45} y="94" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" />
            </g>
          ))}
        </g>
      )}
      {scene === "dots" && (
        <g>
          {[0, 1, 2, 3].map((row) =>
            [0, 1].map((col) => (
              <circle
                key={`${row}-${col}`}
                cx={85 + col * 30}
                cy={55 + row * 30}
                r="6"
                fill="currentColor"
                className={move(`rv-appear rv-appear-${row * 2 + col}`)}
              />
            ))
          )}
        </g>
      )}
      {scene === "pages" && (
        <g>
          <path d="M100 60v90M100 60c-20-8-44-8-60 0v90c16-8 40-8 60 0M100 60c20-8 44-8 60 0v90c-16-8-40-8-60 0" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="2.5" />
          {[0, 1, 2].map((i) => (
            <path key={i} d="M100 62c16-6 34-6 48 0v84c-14-6-32-6-48 0z" className={`fill-surface rv-origin-left ${move(`rv-page rv-page-${i}`)}`} stroke="currentColor" strokeOpacity="0.6" />
          ))}
        </g>
      )}
      {scene === "swing" && (
        <g>
          <circle cx="100" cy="40" r="3" fill="currentColor" />
          <g className={`rv-origin-top ${move("rv-swing")}`}>
            <line x1="100" y1="40" x2="100" y2="140" stroke="currentColor" strokeWidth="1.5" />
            <path d="M100 140l-12 14 12 22 12-22z" fill="currentColor" fillOpacity="0.8" />
          </g>
          <ellipse cx="100" cy="182" rx="50" ry="6" fill="none" stroke="currentColor" strokeOpacity="0.25" strokeDasharray="3 4" />
        </g>
      )}
      {scene === "mist" && (
        <g>
          <circle cx="100" cy="100" r="70" fill="currentColor" fillOpacity="0.08" stroke="currentColor" strokeWidth="2.5" />
          {[0, 1, 2].map((i) => (
            <circle key={i} cx="100" cy="100" r="60" fill="none" stroke="currentColor" strokeOpacity="0.5" className={`rv-origin ${move(`rv-ripple rv-ripple-${i}`)}`} />
          ))}
        </g>
      )}
      {scene === "glow" && (
        <g>
          <circle cx="100" cy="100" r="40" fill="currentColor" fillOpacity="0.2" className={`rv-origin ${move("rv-pulse")}`} />
          <path d="M100 70l7 21 22 1-17 13 6 21-18-12-18 12 6-21-17-13 22-1z" fill="currentColor" fillOpacity="0.8" />
        </g>
      )}
    </svg>
  );
}

/**
 * A cup of the chosen tea, seen from the side: the tea darkens as it steeps, leaves drift in it, steam rises, and a teapot pours at
 * the start. The colours are the tea's own (lib/tea-core.ts).
 */
function Brew({ tea, move }: { tea: TeaKind; move: (c: string) => string }) {
  const t = getTea(tea);
  return (
    <g>
      {/* Steam */}
      {[0, 1, 2].map((i) => (
        <path
          key={i}
          d={`M${80 + i * 20} 70c-8-10 8-16 0-26s8-16 0-26`}
          fill="none"
          stroke="currentColor"
          strokeOpacity="0.55"
          strokeWidth="3"
          strokeLinecap="round"
          className={move(`rv-steam rv-steam-${i}`)}
        />
      ))}
      {/* The teapot's stream at the start */}
      <path d="M150 30c-12 6-30 28-44 56" fill="none" stroke={t.liquor} strokeWidth="5" strokeLinecap="round" className={move("rv-pour")} opacity="0" />
      {/* Saucer */}
      <ellipse cx="100" cy="165" rx="72" ry="12" fill={PORCELAIN.saucer} />
      {/* Handle */}
      <path d="M148 98c22-2 22 34 -4 36" fill="none" stroke={PORCELAIN.rim} strokeWidth="8" strokeLinecap="round" />
      {/* Cup body */}
      <path d="M44 86h112c0 40-20 72-56 72s-56-32-56-72z" fill={PORCELAIN.rim} />
      {/* The inside of the cup behind the tea */}
      <ellipse cx="100" cy="86" rx="56" ry="11" fill={PORCELAIN.bowl} />
      {/* The tea's surface: pale at first, deepening to the tea's own colour */}
      <ellipse cx="100" cy="88" rx="54" ry="10" fill={t.liquor} fillOpacity="0.25" />
      <ellipse cx="100" cy="88" rx="54" ry="10" fill={t.liquor} className={move("rv-steep")} />
      {/* Leaves turning in the cup */}
      <g className={move("rv-drift")}>
        {[[-30, 0], [-12, 4], [8, -3], [24, 3], [36, -1], [-40, 2]].map(([dx, dy], i) => (
          <ellipse key={i} cx={100 + dx} cy={88 + dy} rx="3.2" ry="1.4" fill={t.leaf} transform={`rotate(${i * 37} ${100 + dx} ${88 + dy})`} />
        ))}
      </g>
      <ellipse cx="100" cy="86" rx="56" ry="11" fill="none" stroke={PORCELAIN.shade} strokeWidth="2" />
    </g>
  );
}
