import { styleRef } from "@/lib/apply-style";
import { SigilMark } from "@/components/ui/AppSigil";

const ANIMATIONS = ["shuffle-0", "shuffle-1", "shuffle-2", "shuffle-3", "shuffle-4"];
/** One pass of the cards, at its normal speed; the pass loops for the whole wait (owner's request, 2026-10-29). */
export const SHUFFLE_SECONDS = 1.5;

/**
 * The five card backs with the app's sigil, shuffling (the keyframes are shuffle-0 to shuffle-4 in app/globals.css). Used by the wait
 * while a draw is made (components/ShuffleOverlay.tsx) and by the opening of a card reading (components/reveal/RevealScene.tsx), which
 * had a three-card star drawing in its place until the owner asked for this one back (2026-11-01). `still` lays the five backs in a
 * small fan without movement, for a covered reading.
 */
export default function ShuffleDeck({ still = false, className = "" }: { still?: boolean; className?: string }) {
  return (
    <div aria-hidden="true" className={`flex items-center justify-center ${className}`}>
      <div className={`relative w-[120px] h-[200px] shrink-0 ${still ? "scale-[0.38]" : ""}`}>
        {ANIMATIONS.map((name, i) => (
          <div
            key={name}
            className="absolute inset-0 rounded-xl border-2 border-line-accent shadow-xl shadow-tone-900/60 [background:linear-gradient(135deg,#1a1045_0%,#0d0d26_100%)]"
            ref={styleRef(
              still
                ? { transform: `rotate(${(i - 2) * 4}deg)`, zIndex: 5 - i }
                : {
                    animation: `${name} ${SHUFFLE_SECONDS}s ease-in-out infinite`,
                    // A negative delay starts each card part-way through its pass, so none waits still at the start.
                    animationDelay: `${-i * 0.1}s`,
                    zIndex: 5 - i,
                  }
            )}
          >
            {/* Card back decoration */}
            <div className="absolute inset-[6px] rounded-lg border border-line">
              <div className="absolute inset-[6px] rounded-md border border-tone-600/20 flex items-center justify-center">
                {/* 2.5 times the old text-xl size (owner's request, 2026-11-01). */}
                <SigilMark className="text-tone-500/60 text-[50px] select-none" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
