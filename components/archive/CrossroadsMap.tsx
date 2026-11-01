"use client";

// ─── CrossroadsMap ────────────────────────────────────────────────────────────
// An illustrated pocket-dimension map of the app world.
// Clicking any location navigates there. The current page glows.
//
// Layout (viewBox 0 0 500 540):
//   Full terrain — no sky zone. Enchanted forest at night.
//
//   NE  — The Seeing Pool    (readings)   ~(370, 120)
//   SE  — The Spread Altar   (spreads)    ~(445, 375)
//   SW  — The Dream Cavern   (journals)   ~(115, 435)
//   NW  — The Village Square (forum)      ~( 75, 148)
//   Centre — The Tower, three levels:
//              Top    — Lookout  (home)        y ~200–252
//              Middle — Library  (library)     y ~256–304
//              Bottom — Sanctum  (settings)    y ~308–364

import { usePathname, useRouter } from "next/navigation";

const W  = 500;
const H  = 540;
const TX = 255; // tower x centre

interface Loc {
  href:  string;
  label: string;
  x:     number;
  y:     number;
  hitR:  number;
}

const LOCS: Loc[] = [
  { href: "/",         label: "The Tower",    x: TX,  y: 190, hitR: 18 },
  { href: "/readings", label: "Seeing Pool",  x: 370, y: 120, hitR: 44 },
  { href: "/spreads",  label: "Spread Altar", x: 445, y: 375, hitR: 36 },
  { href: "/journals", label: "Dream Cavern", x: 115, y: 435, hitR: 38 },
  { href: "/forum",    label: "Village Sq.",  x:  75, y: 148, hitR: 42 },
  { href: "/library",  label: "The Library",  x: TX,  y: 248, hitR: 20 },
  { href: "/settings", label: "The Sanctum",  x: TX,  y: 308, hitR: 20 },
];

// Math.sin and Math.cos differ between JavaScript engines in their last digits, so the server and the browser
// would print slightly different numbers and React would report a hydration mismatch. Rounding makes them equal.
const round = (value: number, factor: number) => Math.round(value * factor) / factor;

// Fireflies / foxfire — warm spores scattered across the terrain
const FIREFLIES = Array.from({ length: 55 }, (_, i) => {
  const s = Math.sin(i * 127.1 + 311.7) * 43758.5453;
  const t = Math.sin(i * 269.5 + 183.3) * 43758.5453;
  const u = Math.sin(i * 53.9  + 79.1 ) * 43758.5453;
  const v = Math.sin(i * 89.3  + 45.7 ) * 43758.5453;
  const fx = s - Math.floor(s);
  const fy = t - Math.floor(t);
  const hue = v - Math.floor(v);
  // NE area: blue-white near the pool; elsewhere: emerald, amber, purple
  const color =
    fy < 0.28 && fx > 0.55 ? "#7dd3fc" :
    hue > 0.6              ? "#6ee7b7" :
    hue > 0.3              ? "#fbbf24" :
                             "#a78bfa";
  return {
    x: round(fx * 460 + 20, 100),
    y: round(fy * 520 + 10, 100),
    r: round((u - Math.floor(u)) * 0.8 + 0.3, 1000),
    o: round((Math.sin(i * 37.1) * 0.5 + 0.5) * 0.18 + 0.04, 1000),
    d: round((Math.sin(i * 23.7) * 0.5 + 0.5) * 3.5 + 1.5, 100),
    color,
  };
});

interface Props {
  size?:      number;
  className?: string;
}

export default function CrossroadsMap({ size = 420, className }: Props) {
  const pathname = usePathname();
  const router   = useRouter();

  const cur = LOCS.find((l) => l.href === pathname) ?? LOCS[0];

  function go(href: string) { router.push(href); }

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width={size}
      height={Math.round(size * H / W)}
      className={className}
      style={{ display: "block" }}
      aria-label="Crossroads of Tarot — map"
      role="img"
    >
      <defs>
        {/* ── Gradients ── */}
        <radialGradient id="cm-bg" cx="45%" cy="50%" r="70%">
          <stop offset="0%"   stopColor="#0d1a0f"/>
          <stop offset="60%"  stopColor="#080f0a"/>
          <stop offset="100%" stopColor="#040709"/>
        </radialGradient>

        <radialGradient id="cm-clearing" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1a2e1c" stopOpacity="0.9"/>
          <stop offset="100%" stopColor="#111f14" stopOpacity="0"/>
        </radialGradient>

        <radialGradient id="cm-pool" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#1e4f7a"/>
          <stop offset="60%"  stopColor="#0d2a4a"/>
          <stop offset="100%" stopColor="#071525"/>
        </radialGradient>

        <radialGradient id="cm-tower-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#7c3aed" stopOpacity="0.4"/>
          <stop offset="100%" stopColor="#7c3aed" stopOpacity="0"/>
        </radialGradient>

        <radialGradient id="cm-sanctum-glow" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="#a78bfa" stopOpacity="0.35"/>
          <stop offset="100%" stopColor="#a78bfa" stopOpacity="0"/>
        </radialGradient>

        <radialGradient id="cm-cavern-glow" cx="50%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#6d28d9" stopOpacity="0.5"/>
          <stop offset="100%" stopColor="#6d28d9" stopOpacity="0"/>
        </radialGradient>

        <radialGradient id="cm-village-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="#f59e0b" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="#f59e0b" stopOpacity="0"/>
        </radialGradient>

        <radialGradient id="cm-altar-glow" cx="50%" cy="50%" r="60%">
          <stop offset="0%"   stopColor="#fbbf24" stopOpacity="0.2"/>
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0"/>
        </radialGradient>

        {/* ── Filters ── */}
        <filter id="cm-blur-sm" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="3"/>
        </filter>
        <filter id="cm-blur-md" x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation="7"/>
        </filter>
        <filter id="cm-blur-lg" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="14"/>
        </filter>

        <clipPath id="cm-clip-map">
          <rect width={W} height={H} rx="16"/>
        </clipPath>
      </defs>

      {/* ════════════════════════════════════════════════════════════════
           BACKGROUND — dark enchanted forest floor
         ════════════════════════════════════════════════════════════════ */}
      <rect width={W} height={H} rx="16" fill="url(#cm-bg)"/>

      {/* ── NW forest mass ── */}
      <ellipse cx="55"  cy="88"  rx="58" ry="52" fill="#0b150d" opacity="0.9"/>
      <ellipse cx="108" cy="62"  rx="48" ry="40" fill="#0a1309" opacity="0.9"/>
      <ellipse cx="25"  cy="172" rx="40" ry="58" fill="#0c170e" opacity="0.8"/>
      <ellipse cx="148" cy="92"  rx="36" ry="32" fill="#0e1c10" opacity="0.7"/>
      {[
        [42,52],[60,44],[78,38],[96,50],[28,78],[52,72],[74,88],[112,35],[128,52],
        [18,112],[38,120],[55,108],[20,148],[45,158],[32,192],
      ].map(([cx, cy], i) => (
        <circle key={`tnw-${i}`} cx={cx} cy={cy} r={3.5 + (i % 3) * 1.5}
                fill="#0f1e11" stroke="#162214" strokeWidth="0.5" opacity={0.6 + (i % 3) * 0.15}/>
      ))}

      {/* ── NE forest mass ── */}
      <ellipse cx="455" cy="72"  rx="52" ry="48" fill="#0b150d" opacity="0.85"/>
      <ellipse cx="492" cy="145" rx="28" ry="58" fill="#0c180e" opacity="0.8"/>
      <ellipse cx="418" cy="52"  rx="42" ry="34" fill="#0a1309" opacity="0.9"/>
      {[
        [432,42],[450,35],[470,48],[488,62],[492,102],[478,118],[462,92],
        [492,172],[482,188],
      ].map(([cx, cy], i) => (
        <circle key={`tne-${i}`} cx={cx} cy={cy} r={3.5 + (i % 3) * 1.5}
                fill="#0f1e11" stroke="#162214" strokeWidth="0.5" opacity={0.6 + (i % 3) * 0.15}/>
      ))}

      {/* ── SE forest mass ── */}
      <ellipse cx="482" cy="462" rx="36" ry="52" fill="#0b150d" opacity="0.85"/>
      <ellipse cx="445" cy="505" rx="42" ry="36" fill="#0c180e" opacity="0.8"/>
      <ellipse cx="492" cy="395" rx="20" ry="32" fill="#0a1309" opacity="0.7"/>
      {[
        [476,428],[490,448],[470,482],[452,498],[494,472],[480,498],[492,515],
      ].map(([cx, cy], i) => (
        <circle key={`tse-${i}`} cx={cx} cy={cy} r={3.5 + (i % 3) * 1.5}
                fill="#0f1e11" stroke="#162214" strokeWidth="0.5" opacity={0.6 + (i % 3) * 0.15}/>
      ))}

      {/* ── SW forest mass ── */}
      <ellipse cx="28"  cy="422" rx="36" ry="52" fill="#0b150d" opacity="0.85"/>
      <ellipse cx="58"  cy="492" rx="52" ry="40" fill="#0c180e" opacity="0.8"/>
      <ellipse cx="18"  cy="348" rx="24" ry="42" fill="#0a1309" opacity="0.7"/>
      <ellipse cx="72"  cy="512" rx="38" ry="28" fill="#0b150d" opacity="0.75"/>
      {[
        [16,368],[32,358],[22,392],[44,410],[18,442],[36,458],[54,468],[66,502],[28,515],
      ].map(([cx, cy], i) => (
        <circle key={`tsw-${i}`} cx={cx} cy={cy} r={3.5 + (i % 3) * 1.5}
                fill="#0f1e11" stroke="#162214" strokeWidth="0.5" opacity={0.6 + (i % 3) * 0.15}/>
      ))}

      {/* ── South forest fringe ── */}
      <ellipse cx="198" cy="522" rx="62" ry="28" fill="#0b150d" opacity="0.7"/>
      <ellipse cx="322" cy="528" rx="55" ry="26" fill="#0b140d" opacity="0.65"/>

      {/* ── Central clearing around tower ── */}
      <path
        d="M 182 218 C 192 182, 238 166, 286 178
           C 322 188, 352 220, 346 272
           C 340 318, 308 362, 268 376
           C 238 387, 202 368, 188 334
           C 170 295, 170 252, 182 218 Z"
        fill="#111f14" opacity="0.75"
      />
      <circle cx={TX} cy="285" r="78" fill="url(#cm-clearing)" opacity="0.5"/>

      {/* ── Wetland patch near Seeing Pool ── */}
      <ellipse cx="392" cy="148" rx="68" ry="48" fill="#071a30" opacity="0.55"/>
      <ellipse cx="372" cy="128" rx="52" ry="40" fill="#08203a" opacity="0.4"/>

      {/* ── Scorched earth near Dream Cavern ── */}
      <ellipse cx="118" cy="442" rx="64" ry="44" fill="#0d0820" opacity="0.72"/>
      <ellipse cx="98"  cy="458" rx="40" ry="28" fill="#08050f" opacity="0.6"/>

      {/* ── Rocky shelf near Spread Altar ── */}
      <path d="M 392 342 C 414 325, 458 332, 478 358
               C 492 376, 482 408, 456 414
               C 430 418, 393 402, 382 380
               C 372 360, 378 352, 392 342 Z"
            fill="#0f0c1a" opacity="0.65"/>

      {/* ── Hillside near Village ── */}
      <path d="M 18 98 C 38 78, 82 88, 124 110
               C 148 122, 158 150, 142 170
               C 126 190, 88 196, 58 188
               C 28 180, 8 158, 12 132
               C 15 116, 18 106, 18 98 Z"
            fill="#12190e" opacity="0.55"/>

      {/* Fireflies */}
      {FIREFLIES.map((f, i) => (
        <circle
          key={`ff-${i}`}
          cx={f.x} cy={f.y} r={f.r}
          fill={f.color} opacity={f.o}
          style={{ animation: `map-twinkle ${f.d}s ease-in-out ${f.d * 0.4}s infinite` }}
        />
      ))}

      {/* ════════════════════════════════════════════════════════════════
           WINDING PATHS — rendered before landmarks so they go under
         ════════════════════════════════════════════════════════════════ */}

      {/* Shadows under all paths */}
      <path d="M 263 337 C 272 280, 318 198, 370 120"
            stroke="#060e08" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M 263 337 C 305 344, 378 360, 445 375"
            stroke="#060408" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M 247 337 C 218 363, 172 396, 115 435"
            stroke="#060408" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M 247 337 C 238 280, 175 215, 75 148"
            stroke="#060e08" strokeWidth="22" strokeLinecap="round" fill="none" opacity="0.6"/>

      {/* Dark earth layer */}
      <path d="M 263 337 C 272 280, 318 198, 370 120"
            stroke="#1a1508" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M 263 337 C 305 344, 378 360, 445 375"
            stroke="#1a1508" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M 247 337 C 218 363, 172 396, 115 435"
            stroke="#1a1508" strokeWidth="14" strokeLinecap="round" fill="none"/>
      <path d="M 247 337 C 238 280, 175 215, 75 148"
            stroke="#1a1508" strokeWidth="14" strokeLinecap="round" fill="none"/>

      {/* Lighter stone surface */}
      <path d="M 263 337 C 272 280, 318 198, 370 120"
            stroke="#252010" strokeWidth="9" strokeLinecap="round" fill="none"/>
      <path d="M 263 337 C 305 344, 378 360, 445 375"
            stroke="#252010" strokeWidth="9" strokeLinecap="round" fill="none"/>
      <path d="M 247 337 C 218 363, 172 396, 115 435"
            stroke="#252010" strokeWidth="9" strokeLinecap="round" fill="none"/>
      <path d="M 247 337 C 238 280, 175 215, 75 148"
            stroke="#252010" strokeWidth="9" strokeLinecap="round" fill="none"/>

      {/* Worn centre highlight */}
      <path d="M 263 337 C 272 280, 318 198, 370 120"
            stroke="#342c12" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M 263 337 C 305 344, 378 360, 445 375"
            stroke="#342c12" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M 247 337 C 218 363, 172 396, 115 435"
            stroke="#342c12" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6"/>
      <path d="M 247 337 C 238 280, 175 215, 75 148"
            stroke="#342c12" strokeWidth="4" strokeLinecap="round" fill="none" opacity="0.6"/>

      {/* Edge stitching — dashed track marks */}
      <path d="M 263 337 C 272 280, 318 198, 370 120"
            stroke="#4a3c18" strokeWidth="0.7" strokeLinecap="round" fill="none"
            strokeDasharray="2.5 7" opacity="0.5"/>
      <path d="M 263 337 C 305 344, 378 360, 445 375"
            stroke="#4a3c18" strokeWidth="0.7" strokeLinecap="round" fill="none"
            strokeDasharray="2.5 7" opacity="0.5"/>
      <path d="M 247 337 C 218 363, 172 396, 115 435"
            stroke="#4a3c18" strokeWidth="0.7" strokeLinecap="round" fill="none"
            strokeDasharray="2.5 7" opacity="0.5"/>
      <path d="M 247 337 C 238 280, 175 215, 75 148"
            stroke="#4a3c18" strokeWidth="0.7" strokeLinecap="round" fill="none"
            strokeDasharray="2.5 7" opacity="0.5"/>


      {/* ════════════════════════════════════════════════════════════════
           THE SEEING POOL  (readings — NE, 370 120)
         ════════════════════════════════════════════════════════════════ */}

      {/* Terrain glow */}
      <circle cx="370" cy="120" r="62" fill="url(#cm-pool)" opacity="0.45" filter="url(#cm-blur-md)"/>

      {/* Pool water */}
      <circle cx="370" cy="120" r="44" fill="#071525"/>
      <circle cx="370" cy="120" r="44" fill="url(#cm-pool)" opacity="0.9"/>

      {/* Shimmer highlight */}
      <ellipse cx="358" cy="108" rx="14" ry="6" fill="#7dd3fc" opacity="0.12"
               transform="rotate(-20 358 108)"/>

      {/* Ripple rings */}
      <circle cx="370" cy="120" r="32" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4"
              style={{ animation: "map-ripple 3s ease-out 0s infinite" }}/>
      <circle cx="370" cy="120" r="32" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4"
              style={{ animation: "map-ripple 3s ease-out 1s infinite" }}/>
      <circle cx="370" cy="120" r="32" fill="none" stroke="#38bdf8" strokeWidth="0.8" opacity="0.4"
              style={{ animation: "map-ripple 3s ease-out 2s infinite" }}/>

      {/* Moon reflection */}
      <ellipse cx="370" cy="126" rx="5" ry="7" fill="#e0f2fe" opacity="0.18"/>
      <path d="M 365 121 Q 370 133 375 121" fill="#bae6fd" opacity="0.12"/>

      {/* Rocky pool edge */}
      <circle cx="370" cy="120" r="46" fill="none" stroke="#0f4a6e" strokeWidth="3.5"/>
      <circle cx="370" cy="120" r="48" fill="none" stroke="#0a2a40" strokeWidth="2"/>

      {/* Mossy stones around edge */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = (deg * Math.PI) / 180;
        const sx  = round(370 + Math.cos(rad) * 50, 100);
        const sy  = round(120 + Math.sin(rad) * 50, 100);
        return <circle key={`stone-${i}`} cx={sx} cy={sy} r="3.5"
                       fill="#0d3a52" stroke="#0a2233" strokeWidth="0.8"/>;
      })}

      {/* Label */}
      <text x="370" y="178" textAnchor="middle" fill="#7dd3fc" fontSize="9.5"
            fontFamily="system-ui" letterSpacing="0.08em" opacity="0.85">
        SEEING POOL
      </text>


      {/* ════════════════════════════════════════════════════════════════
           THE SPREAD ALTAR  (spreads — SE, 445 375)
         ════════════════════════════════════════════════════════════════ */}

      {/* Terrain glow */}
      <circle cx="445" cy="375" r="52" fill="url(#cm-altar-glow)" filter="url(#cm-blur-md)"/>

      {/* Stone altar slab */}
      <rect x="411" y="362" width="68" height="26" rx="4"
            fill="#1a1030" stroke="#2d1d50" strokeWidth="1.5"/>
      {/* Altar top surface */}
      <rect x="413" y="360" width="64" height="6" rx="3"
            fill="#241840" stroke="#3b2a6a" strokeWidth="0.8"/>
      {/* Altar legs */}
      <rect x="416" y="388" width="8" height="10" rx="2" fill="#130c25"/>
      <rect x="466" y="388" width="8" height="10" rx="2" fill="#130c25"/>

      {/* Candles */}
      <rect x="414" y="352" width="4" height="10" rx="1" fill="#e5e7eb" opacity="0.7"/>
      <rect x="472" y="352" width="4" height="10" rx="1" fill="#e5e7eb" opacity="0.7"/>
      {/* Flames */}
      <ellipse cx="416" cy="351" rx="2" ry="3" fill="#fbbf24"
               style={{ animation: "map-twinkle 1.2s ease-in-out 0s infinite" }}/>
      <ellipse cx="474" cy="351" rx="2" ry="3" fill="#fbbf24"
               style={{ animation: "map-twinkle 1.4s ease-in-out 0.3s infinite" }}/>
      <circle cx="416" cy="351" r="6" fill="#fbbf24" opacity="0.12" filter="url(#cm-blur-sm)"/>
      <circle cx="474" cy="351" r="6" fill="#fbbf24" opacity="0.12" filter="url(#cm-blur-sm)"/>

      {/* Cards on altar */}
      <rect x="423" y="362" width="9" height="13" rx="1.5" fill="#7c3aed" opacity="0.8"
            transform="rotate(-5 423 362)"/>
      <rect x="435" y="361" width="9" height="13" rx="1.5" fill="#4f46e5" opacity="0.8"/>
      <rect x="447" y="362" width="9" height="13" rx="1.5" fill="#7c3aed" opacity="0.8"
            transform="rotate(4 447 362)"/>
      <text x="427" y="370" fontSize="5" fill="#c4b5fd" opacity="0.9" textAnchor="middle">✦</text>
      <text x="439" y="370" fontSize="5" fill="#c4b5fd" opacity="0.9" textAnchor="middle">✦</text>
      <text x="451" y="370" fontSize="5" fill="#c4b5fd" opacity="0.9" textAnchor="middle">✦</text>

      {/* Rune markings */}
      <text x="445" y="380" fontSize="5.5" fill="#6d28d9" opacity="0.6" textAnchor="middle"
            fontFamily="system-ui">⬡ ✦ ⬡</text>

      {/* Label */}
      <text x="445" y="415" textAnchor="middle" fill="#c4b5fd" fontSize="9.5"
            fontFamily="system-ui" letterSpacing="0.08em" opacity="0.85">
        SPREAD ALTAR
      </text>


      {/* ════════════════════════════════════════════════════════════════
           THE DREAM CAVERN  (journals — SW, 115 435)
         ════════════════════════════════════════════════════════════════ */}

      {/* Cavern glow */}
      <ellipse cx="115" cy="423" rx="58" ry="38" fill="url(#cm-cavern-glow)" filter="url(#cm-blur-md)"/>

      {/* Rocky mound */}
      <ellipse cx="115" cy="440" rx="52" ry="22" fill="#100820"/>
      <path d="M 63 436 Q 83 418 115 416 Q 147 418 167 436 L 167 452 Q 115 460 63 452 Z"
            fill="#0f0720"/>

      {/* Cave mouth arch */}
      <path d="M 87 442 Q 87 420 115 420 Q 143 420 143 442"
            fill="#060310" stroke="#2d1460" strokeWidth="1.5"/>
      <path d="M 90 442 Q 90 424 115 424 Q 140 424 140 442"
            fill="#030108"/>

      {/* Crystal formations */}
      <polygon points="99,442 102,427 105,442"  fill="#6d28d9" opacity="0.7"/>
      <polygon points="105,442 109,430 113,442" fill="#7c3aed" opacity="0.6"/>
      <polygon points="117,442 121,432 125,442" fill="#6d28d9" opacity="0.7"/>
      <polygon points="125,442 129,429 133,442" fill="#4f46e5" opacity="0.6"/>
      <polygon points="99,442 102,427 105,442"  fill="#a78bfa" opacity="0.25" filter="url(#cm-blur-sm)"/>
      <polygon points="125,442 129,429 133,442" fill="#a78bfa" opacity="0.25" filter="url(#cm-blur-sm)"/>

      {/* Mist */}
      <ellipse cx="115" cy="428" rx="18" ry="8" fill="#6d28d9" opacity="0.08"
               style={{ animation: "map-mist 4s ease-in-out 0s infinite" }}/>
      <ellipse cx="115" cy="426" rx="12" ry="5" fill="#7c3aed" opacity="0.06"
               style={{ animation: "map-mist 4s ease-in-out 1.3s infinite" }}/>

      {/* Rocky outcrops */}
      <ellipse cx="75"  cy="440" rx="16" ry="10" fill="#12092a" stroke="#1d1040" strokeWidth="1"/>
      <ellipse cx="155" cy="440" rx="16" ry="10" fill="#12092a" stroke="#1d1040" strokeWidth="1"/>

      {/* Label */}
      <text x="115" y="476" textAnchor="middle" fill="#a78bfa" fontSize="9.5"
            fontFamily="system-ui" letterSpacing="0.08em" opacity="0.85">
        DREAM CAVERN
      </text>


      {/* ════════════════════════════════════════════════════════════════
           THE VILLAGE SQUARE  (forum — NW, 75 148)
         ════════════════════════════════════════════════════════════════ */}

      {/* Warmth glow */}
      <circle cx="75" cy="148" r="60" fill="url(#cm-village-glow)" filter="url(#cm-blur-md)"/>

      {/* Cobblestone square */}
      <rect x="47" y="124" width="56" height="48" rx="3" fill="#130e20" stroke="#1d1535" strokeWidth="1"/>
      <line x1="58"  y1="124" x2="58"  y2="172" stroke="#1a1230" strokeWidth="0.6"/>
      <line x1="70"  y1="124" x2="70"  y2="172" stroke="#1a1230" strokeWidth="0.6"/>
      <line x1="82"  y1="124" x2="82"  y2="172" stroke="#1a1230" strokeWidth="0.6"/>
      <line x1="94"  y1="124" x2="94"  y2="172" stroke="#1a1230" strokeWidth="0.6"/>
      <line x1="47"  y1="135" x2="103" y2="135" stroke="#1a1230" strokeWidth="0.6"/>
      <line x1="47"  y1="148" x2="103" y2="148" stroke="#1a1230" strokeWidth="0.6"/>
      <line x1="47"  y1="160" x2="103" y2="160" stroke="#1a1230" strokeWidth="0.6"/>

      {/* Central bonfire */}
      <circle cx="75" cy="148" r="6" fill="#1d1535" stroke="#2d2050" strokeWidth="1"/>
      <ellipse cx="75" cy="144" rx="3" ry="4" fill="#f97316" opacity="0.85"
               style={{ animation: "map-twinkle 0.9s ease-in-out 0s infinite" }}/>
      <ellipse cx="75" cy="143" rx="1.8" ry="3" fill="#fbbf24" opacity="0.7"
               style={{ animation: "map-twinkle 0.7s ease-in-out 0.2s infinite" }}/>
      <circle cx="75" cy="144" r="8" fill="#f97316" opacity="0.12" filter="url(#cm-blur-sm)"/>

      {/* Buildings — north */}
      <rect x="51" y="108" width="22" height="16" rx="2" fill="#1a1030" stroke="#2d1d50" strokeWidth="1"/>
      <polygon points="50,108 73,108 61,100" fill="#130c25" stroke="#2d1d50" strokeWidth="0.8"/>
      <rect x="59" y="112" width="5" height="6" rx="1" fill="#f59e0b" opacity="0.4"/>

      {/* East building */}
      <rect x="85" y="130" width="18" height="22" rx="2" fill="#1a1030" stroke="#2d1d50" strokeWidth="1"/>
      <polygon points="84,130 103,130 93,122" fill="#130c25" stroke="#2d1d50" strokeWidth="0.8"/>
      <rect x="90" y="136" width="4" height="5" rx="1" fill="#f59e0b" opacity="0.35"/>

      {/* West building */}
      <rect x="35" y="134" width="16" height="20" rx="2" fill="#1a1030" stroke="#2d1d50" strokeWidth="1"/>
      <polygon points="34,134 51,134 43,127" fill="#130c25" stroke="#2d1d50" strokeWidth="0.8"/>

      {/* Label */}
      <text x="75" y="190" textAnchor="middle" fill="#fcd34d" fontSize="9.5"
            fontFamily="system-ui" letterSpacing="0.08em" opacity="0.8">
        VILLAGE SQUARE
      </text>


      {/* ════════════════════════════════════════════════════════════════
           THE TOWER — three levels (centre at x=255)
           Battlements  y 186–202
           Lookout      y 170–222  →  home /
           Library      y 226–274  →  /library
           Sanctum      y 278–334  →  /settings
         ════════════════════════════════════════════════════════════════ */}

      {/* Tower glow */}
      <circle cx={TX} cy="254" r="62" fill="url(#cm-tower-glow)" filter="url(#cm-blur-lg)"/>

      {/* Foundation */}
      <ellipse cx={TX} cy="339" rx="32" ry="9" fill="#130c25" stroke="#1d1438" strokeWidth="1"/>

      {/* Tower body */}
      <rect x="239" y="170" width="32" height="164" rx="2" fill="#0f0720" stroke="#2d1460" strokeWidth="1.5"/>

      {/* Battlements */}
      <rect x="237" y="156" width="7"  height="16" rx="1" fill="#0f0720" stroke="#2d1460" strokeWidth="1"/>
      <rect x="246" y="156" width="6"  height="16" rx="1" fill="#0f0720" stroke="#2d1460" strokeWidth="1"/>
      <rect x="254" y="156" width="6"  height="16" rx="1" fill="#0f0720" stroke="#2d1460" strokeWidth="1"/>
      <rect x="262" y="156" width="7"  height="16" rx="1" fill="#0f0720" stroke="#2d1460" strokeWidth="1"/>

      {/* Lookout windows */}
      <rect x="244" y="182" width="6" height="9" rx="1" fill="#7c3aed" opacity="0.9"
            style={{ animation: "map-twinkle 2.5s ease-in-out 0s infinite" }}/>
      <rect x="260" y="182" width="6" height="9" rx="1" fill="#7c3aed" opacity="0.9"
            style={{ animation: "map-twinkle 2.5s ease-in-out 0.8s infinite" }}/>
      <rect x="244" y="182" width="6" height="9" rx="1" fill="#7c3aed" opacity="0.3" filter="url(#cm-blur-sm)"/>
      <rect x="260" y="182" width="6" height="9" rx="1" fill="#7c3aed" opacity="0.3" filter="url(#cm-blur-sm)"/>

      {/* Floor divider: Lookout → Library */}
      <rect x="235" y="222" width="40" height="4" rx="1" fill="#1d1438" stroke="#2d1460" strokeWidth="0.8"/>

      {/* Library windows */}
      <rect x="242" y="234" width="10" height="14" rx="1.5" fill="#10b981" opacity="0.3"/>
      <rect x="258" y="234" width="10" height="14" rx="1.5" fill="#10b981" opacity="0.3"/>
      <rect x="242" y="234" width="10" height="14" rx="1.5" fill="#10b981" opacity="0.15" filter="url(#cm-blur-sm)"/>
      <rect x="258" y="234" width="10" height="14" rx="1.5" fill="#10b981" opacity="0.15" filter="url(#cm-blur-sm)"/>
      {/* Book spines */}
      <rect x="253" y="236" width="4" height="11" rx="0.5" fill="#1a1040" stroke="#2d2060" strokeWidth="0.6"/>
      <line x1="254.5" y1="236" x2="254.5" y2="247" stroke="#2d2060" strokeWidth="0.5"/>
      <line x1="256"   y1="236" x2="256"   y2="247" stroke="#2d2060" strokeWidth="0.5"/>

      {/* Floor divider: Library → Sanctum */}
      <rect x="235" y="274" width="40" height="4" rx="1" fill="#1d1438" stroke="#2d1460" strokeWidth="0.8"/>

      {/* Sanctum windows */}
      <rect x="244" y="286" width="6" height="9" rx="1" fill="#4c1d95" opacity="0.8"
            style={{ animation: "map-pulse-glow 3s ease-in-out 0s infinite" }}/>
      <rect x="260" y="286" width="6" height="9" rx="1" fill="#4c1d95" opacity="0.8"
            style={{ animation: "map-pulse-glow 3s ease-in-out 1s infinite" }}/>
      <rect x="244" y="286" width="6" height="9" rx="1" fill="#7c3aed" opacity="0.2" filter="url(#cm-blur-sm)"/>
      <rect x="260" y="286" width="6" height="9" rx="1" fill="#7c3aed" opacity="0.2" filter="url(#cm-blur-sm)"/>
      {/* Celestial orb */}
      <circle cx={TX} cy="308" r="6" fill="#1a0a3a"/>
      <circle cx={TX} cy="308" r="5" fill="#4c1d95" opacity="0.8"/>
      <circle cx={TX} cy="308" r="3" fill="#7c3aed"
              style={{ animation: "map-pulse-glow 2.5s ease-in-out infinite" }}/>
      <circle cx={TX} cy="308" r="1.5" fill="#c4b5fd"/>
      <circle cx={TX - 1.2} cy={308 - 1.2} r="0.6" fill="#fff" opacity="0.8"/>
      {/* Sanctum arch */}
      <path d={`M ${TX - 12} 334 L ${TX - 12} 320 Q ${TX} 313 ${TX + 12} 320 L ${TX + 12} 334`}
            fill="#04020a"/>
      <rect x={TX - 13} y="318" width="26" height="3" rx="1" fill="#1d1438"/>

      {/* Level labels — left side of tower */}
      <line x1="222" y1="194" x2="237" y2="194" stroke="#c4b5fd" strokeWidth="0.5" opacity="0.4"/>
      <text x="220" y="198" textAnchor="end" fill="#c4b5fd" fontSize="9"
            fontFamily="system-ui" fontWeight="600" letterSpacing="0.1em" opacity="0.9">
        THE TOWER
      </text>
      <line x1="222" y1="250" x2="237" y2="250" stroke="#6ee7b7" strokeWidth="0.5" opacity="0.4"/>
      <text x="220" y="254" textAnchor="end" fill="#6ee7b7" fontSize="9"
            fontFamily="system-ui" letterSpacing="0.08em" opacity="0.8">
        THE LIBRARY
      </text>
      <line x1="222" y1="304" x2="237" y2="304" stroke="#a78bfa" strokeWidth="0.5" opacity="0.4"/>
      <text x="220" y="308" textAnchor="end" fill="#a78bfa" fontSize="9"
            fontFamily="system-ui" letterSpacing="0.08em" opacity="0.9">
        THE SANCTUM
      </text>


      {/* ════════════════════════════════════════════════════════════════
           CURRENT LOCATION INDICATOR
         ════════════════════════════════════════════════════════════════ */}

      <circle
        cx={cur.x} cy={cur.y} r={cur.hitR + 12}
        fill="#7c3aed" opacity="0.15"
        filter="url(#cm-blur-md)"
        style={{ animation: "map-pulse-glow 2s ease-in-out infinite" }}
      />
      <circle
        cx={cur.x} cy={cur.y} r={cur.hitR + 4}
        fill="none" stroke="#a78bfa" strokeWidth="1.5" opacity="0.5"
        style={{ animation: "map-pulse-ring 2s ease-in-out infinite" }}
      />
      <circle cx={cur.x} cy={cur.y} r="5"   fill="#7c3aed" opacity="0.9"/>
      <circle cx={cur.x} cy={cur.y} r="3"   fill="#c4b5fd"/>
      <circle cx={cur.x - 1} cy={cur.y - 1} r="1.2" fill="#fff" opacity="0.7"/>


      {/* ════════════════════════════════════════════════════════════════
           INVISIBLE CLICK TARGETS
         ════════════════════════════════════════════════════════════════ */}
      {LOCS.map((loc) => (
        <circle
          key={loc.href}
          cx={loc.x} cy={loc.y} r={loc.hitR}
          fill="transparent"
          stroke="transparent"
          style={{ cursor: "pointer" }}
          onClick={() => go(loc.href)}
          role="button"
          aria-label={`Navigate to ${loc.label}`}
        >
          <title>{loc.label}</title>
        </circle>
      ))}


      {/* ════════════════════════════════════════════════════════════════
           COMPASS ROSE (decorative, bottom-right)
         ════════════════════════════════════════════════════════════════ */}
      <g opacity="0.35" transform="translate(464, 512)">
        <line x1="0" y1="-10" x2="0"   y2="10" stroke="#6d28d9" strokeWidth="0.8"/>
        <line x1="-10" y1="0" x2="10"  y2="0"  stroke="#6d28d9" strokeWidth="0.8"/>
        <polygon points="0,-12 -2.5,-7 2.5,-7"  fill="#a78bfa"/>
        <text x="0" y="-13" textAnchor="middle" fill="#a78bfa" fontSize="5" fontFamily="system-ui">N</text>
      </g>

      {/* Map border */}
      <rect width={W} height={H} rx="16" fill="none" stroke="#2d1460" strokeWidth="1.5" opacity="0.6"/>
      <rect width={W} height={H} rx="16" fill="none" stroke="#4c1d95" strokeWidth="0.5" opacity="0.3"/>
    </svg>
  );
}
