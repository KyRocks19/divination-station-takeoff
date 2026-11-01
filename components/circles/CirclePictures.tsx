// The pictures on "Circles and Tailscale" (app/guide/circles): friends around the world, each in a small round window with the sun or
// the moon over them, joined by threads to the Winged host computers in the middle, and one Feathered person alone inside a closed circle.
// Plain SVG with no script, so a server page can draw them. The page's colours (sky, lines, threads, clothes, devices) are theme tokens, so
// every theme, Daylight too, colours them. Skin and hair keep fixed colours on purpose: a person's skin does not change with a theme.
// The threads and stars move very slowly; "less motion" and the device setting stop them (the catch-alls in app/globals.css).

type Hair = "short" | "long" | "afro" | "bun" | "braids" | "hijab" | "curly" | "none" | "locs";
type Device = "phone" | "tablet" | "laptop" | "pc";

export interface Friend {
  skin: string;
  hair: Hair;
  hairColor: string;
  /** A fill class from the theme, for the clothes. */
  clothes: string;
  device: Device;
  /** The sun or the moon over them: it is a different time of day where each friend lives. */
  sky: "sun" | "moon";
  glasses?: boolean;
  beard?: boolean;
}

// Fixed on purpose (see the top of the file).
const SKIN = ["#f6dcc4", "#eabf98", "#d49a6a", "#b97a4f", "#8d5a3b", "#6b4029", "#4a2c1d", "#f1c9a5"];
const HAIR = { black: "#1f1410", brown: "#4a2c19", auburn: "#8a3b1e", blonde: "#d9b26a", grey: "#bdb8b2", violet: "#8e4fd6", teal: "#2f8f88", rose: "#d2557f" };
const EYES = "#2b1d16";

/** Everyone who appears in the pictures, in the order they are placed. */
export const FRIENDS: Friend[] = [
  { skin: SKIN[4], hair: "afro", hairColor: HAIR.black, clothes: "fill-warning", device: "phone", sky: "sun" },
  { skin: SKIN[0], hair: "long", hairColor: HAIR.auburn, clothes: "fill-tone-500", device: "laptop", sky: "moon", glasses: true },
  { skin: SKIN[2], hair: "hijab", hairColor: "", clothes: "fill-success", device: "tablet", sky: "sun" },
  { skin: SKIN[6], hair: "locs", hairColor: HAIR.black, clothes: "fill-blush-soft", device: "pc", sky: "moon", beard: true },
  { skin: SKIN[7], hair: "bun", hairColor: HAIR.black, clothes: "fill-danger-soft", device: "phone", sky: "moon" },
  { skin: SKIN[1], hair: "none", hairColor: HAIR.grey, clothes: "fill-tone-300", device: "pc", sky: "sun", glasses: true, beard: true },
  { skin: SKIN[5], hair: "braids", hairColor: HAIR.violet, clothes: "fill-accent", device: "laptop", sky: "sun" },
  { skin: SKIN[3], hair: "curly", hairColor: HAIR.brown, clothes: "fill-blush", device: "tablet", sky: "moon" },
  { skin: SKIN[0], hair: "short", hairColor: HAIR.teal, clothes: "fill-success", device: "phone", sky: "sun" },
  { skin: SKIN[2], hair: "long", hairColor: HAIR.black, clothes: "fill-warning", device: "laptop", sky: "moon" },
  { skin: SKIN[5], hair: "short", hairColor: HAIR.grey, clothes: "fill-tone-500", device: "tablet", sky: "moon", glasses: true },
  { skin: SKIN[7], hair: "curly", hairColor: HAIR.rose, clothes: "fill-blush-soft", device: "pc", sky: "sun" },
];

const W = 720;
const H = 440;
const PORTAL = 40;

// ─── small pieces ────────────────────────────────────────────────────────────

function Star({ x, y, size = 4, slow = 0 }: { x: number; y: number; size?: number; slow?: number }) {
  const s = size;
  const delay = ["", "[animation-delay:-7s]", "[animation-delay:-15s]", "[animation-delay:-23s]"][slow % 4];
  return (
    <path
      d={`M${x} ${y - s} L${x + s * 0.28} ${y - s * 0.28} L${x + s} ${y} L${x + s * 0.28} ${y + s * 0.28} L${x} ${y + s} L${x - s * 0.28} ${y + s * 0.28} L${x - s} ${y} L${x - s * 0.28} ${y - s * 0.28} Z`}
      className={`fill-warning circle-twinkle ${delay}`}
    />
  );
}

/** The starry sky and a faint globe behind every picture. */
function Sky({ seed }: { seed: number }) {
  const stars: [number, number, number][] = [];
  let n = seed * 9301 + 49297;
  const rand = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < 26; i++) stars.push([rand() * W, rand() * H, 1.5 + rand() * 3]);
  return (
    <>
      <rect x={0} y={0} width={W} height={H} rx={24} className="fill-surface-sunken" />
      <g className="stroke-line-faint" fill="none" strokeWidth={1.5}>
        <circle cx={W / 2} cy={H / 2} r={200} />
        <ellipse cx={W / 2} cy={H / 2} rx={90} ry={200} />
        <ellipse cx={W / 2} cy={H / 2} rx={160} ry={200} />
        <ellipse cx={W / 2} cy={H / 2} rx={200} ry={80} />
        <path d={`M${W / 2 - 200} ${H / 2} H${W / 2 + 200}`} />
      </g>
      {stars.map(([x, y, s], i) => <Star key={i} x={x} y={y} size={s} slow={i} />)}
    </>
  );
}

function Hair({ f, back }: { f: Friend; back: boolean }) {
  const c = f.hairColor;
  if (back) {
    switch (f.hair) {
      case "afro": return <circle cx={0} cy={-10} r={21} fill={c} />;
      case "long": return <rect x={-14} y={-18} width={28} height={36} rx={12} fill={c} />;
      case "locs": return <g fill={c}>{[-13, -8, 8, 13].map((x) => <rect key={x} x={x - 2.5} y={-12} width={5} height={30} rx={2.5} />)}</g>;
      case "braids": return <g fill={c}><rect x={-15} y={-10} width={6} height={30} rx={3} /><rect x={9} y={-10} width={6} height={30} rx={3} /></g>;
      case "bun": return <circle cx={0} cy={-21} r={6} fill={c} />;
      case "hijab": return <><circle cx={0} cy={-5} r={15} className="fill-tone-500" /><path d="M-15 -3 C-20 16 -12 24 0 24 C12 24 20 16 15 -3 Z" className="fill-tone-500" /></>;
      default: return null;
    }
  }
  switch (f.hair) {
    case "short":
    case "long":
    case "bun":
    case "braids":
    case "locs":
      return <path d="M-12.5 -6 C-13 -21 13 -21 12.5 -6 C9 -13 -5 -15 -12.5 -6 Z" fill={c} />;
    case "curly":
      return <g fill={c}>{[-11, -6, 0, 6, 11].map((x, i) => <circle key={x} cx={x} cy={-15 + (i % 2) * 2 + (Math.abs(x) > 8 ? 4 : 0)} r={5.5} />)}</g>;
    case "afro":
      return <path d="M-12 -7 C-12 -18 12 -18 12 -7 C8 -12 -8 -12 -12 -7 Z" fill={c} />;
    default:
      return null;
  }
}

function Device({ kind }: { kind: Device }) {
  switch (kind) {
    case "phone":
      return (
        <g transform="rotate(-8 12 4)">
          <rect x={7} y={-4} width={11} height={19} rx={2.5} className="fill-canvas stroke-line-strong" strokeWidth={1} />
          <rect x={8.5} y={-2} width={8} height={14} rx={1} className="fill-blush/50" />
        </g>
      );
    case "tablet":
      return (
        <g>
          <rect x={-15} y={13} width={30} height={20} rx={3} className="fill-canvas stroke-line-strong" strokeWidth={1} />
          <circle cx={0} cy={23} r={3} className="fill-blush/60" />
        </g>
      );
    case "laptop":
      return (
        <g>
          <rect x={-17} y={12} width={34} height={20} rx={2} className="fill-canvas stroke-line-strong" strokeWidth={1} />
          <Crescent x={0} y={22} r={4.5} moon="fill-blush" behind="fill-canvas" />
          <rect x={-21} y={31} width={42} height={4} rx={1.5} className="fill-ink-ghost" />
        </g>
      );
    case "pc":
      return (
        <g>
          <rect x={12} y={-6} width={24} height={18} rx={2} className="fill-canvas stroke-line-strong" strokeWidth={1} />
          <rect x={14} y={-4} width={20} height={14} rx={1} className="fill-blush/45" />
          <rect x={22} y={12} width={4} height={8} className="fill-ink-ghost" />
          <rect x={-18} y={27} width={34} height={5} rx={1.5} className="fill-ink-ghost" />
        </g>
      );
  }
}

function Body({ f }: { f: Friend }) {
  return (
    <g>
      <Hair f={f} back />
      <path d="M-24 44 C-24 20 -15 13 0 13 C15 13 24 20 24 44 Z" className={f.clothes} />
      {f.hair === "hijab" ? (
        <path d="M-12 0 C-15 16 -7 22 0 22 C7 22 15 16 12 0 Z" className="fill-tone-500" />
      ) : (
        <rect x={-4} y={3} width={8} height={11} rx={2} fill={f.skin} />
      )}
      {f.hair === "hijab" ? <ellipse cx={0} cy={-5} rx={9.5} ry={11} fill={f.skin} /> : <circle cx={0} cy={-6} r={12} fill={f.skin} />}
      <Hair f={f} back={false} />
      <circle cx={-4.2} cy={-6} r={1.4} fill={EYES} />
      <circle cx={4.2} cy={-6} r={1.4} fill={EYES} />
      <path d="M-3.5 -0.5 Q0 2.5 3.5 -0.5" fill="none" stroke={EYES} strokeWidth={1.1} strokeLinecap="round" />
      {f.beard && <path d="M-10 -3 C-9 8 9 8 10 -3 C6 3 -6 3 -10 -3 Z" fill={f.hairColor} />}
      {f.glasses && (
        <g fill="none" className="stroke-ink-strong" strokeWidth={1}>
          <circle cx={-4.5} cy={-6} r={3.6} />
          <circle cx={4.5} cy={-6} r={3.6} />
          <path d="M-0.9 -6 H0.9" />
        </g>
      )}
      <Device kind={f.device} />
    </g>
  );
}

/** A crescent moon: a round moon with a second circle in the colour behind it laid over one side. */
function Crescent({ x, y, r, moon, behind }: { x: number; y: number; r: number; moon: string; behind: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r={r} className={moon} />
      <circle cx={x + r * 0.45} cy={y - r * 0.3} r={r * 0.85} className={behind} />
    </g>
  );
}

function SkyMark({ kind }: { kind: "sun" | "moon" }) {
  return kind === "sun" ? (
    <g transform="translate(-22 -24)">
      <circle r={5} className="fill-warning" />
      <g className="stroke-warning" strokeWidth={1.4} strokeLinecap="round">
        {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
          <path key={a} d="M0 -7.5 V-10" transform={`rotate(${a})`} />
        ))}
      </g>
    </g>
  ) : (
    <Crescent x={-22} y={-24} r={7} moon="fill-tone-200" behind="fill-surface" />
  );
}

/** One friend in their round window. `id` must be unique on the page: it names the window's clip. */
function Portal({ id, x, y, f, scale = 1 }: { id: string; x: number; y: number; f: Friend; scale?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <clipPath id={id}>
        <circle r={PORTAL} />
      </clipPath>
      <circle r={PORTAL + 4} className="fill-blush-deep/15" />
      <circle r={PORTAL} className="fill-surface" />
      <g clipPath={`url(#${id})`}>
        <SkyMark kind={f.sky} />
        <g transform="translate(2 4)">
          <Body f={f} />
        </g>
      </g>
      <circle r={PORTAL} fill="none" className="stroke-line-accent" strokeWidth={2} />
    </g>
  );
}

/** A Winged host's computer: a screen with the moon on it, a tower, wings, and a circle of candle-lights around it. */
function Host({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <circle r={66} className="fill-tone-700/20" />
      <circle r={62} fill="none" className="stroke-blush-deep/70" strokeWidth={1.5} strokeDasharray="2 7" strokeLinecap="round" />
      {[0, 60, 120, 180, 240, 300].map((a) => (
        <g key={a} transform={`rotate(${a}) translate(0 -62)`}>
          <circle r={4} className="fill-warning/30" />
          <circle r={2} className="fill-warning" />
        </g>
      ))}
      {/* the wings */}
      <g className="fill-tone-300/80">
        <path d="M-34 -8 C-52 -30 -66 -22 -62 -6 C-58 -12 -52 -10 -48 -4 C-55 -6 -58 2 -50 6 C-46 2 -40 2 -34 6 Z" />
        <path d="M34 -8 C52 -30 66 -22 62 -6 C58 -12 52 -10 48 -4 C55 -6 58 2 50 6 C46 2 40 2 34 6 Z" />
      </g>
      {/* the screen */}
      <rect x={-34} y={-30} width={68} height={46} rx={4} className="fill-canvas stroke-blush-deep" strokeWidth={2} />
      <Crescent x={-2} y={-8} r={12} moon="fill-blush" behind="fill-canvas" />
      <Star x={16} y={-16} size={3.5} />
      <Star x={-20} y={4} size={2.5} slow={2} />
      <rect x={-5} y={16} width={10} height={9} className="fill-ink-ghost" />
      <rect x={-20} y={25} width={40} height={4} rx={2} className="fill-ink-ghost" />
      {/* the tower */}
      <rect x={40} y={-2} width={16} height={32} rx={2} className="fill-canvas stroke-line-strong" strokeWidth={1.5} />
      <circle cx={48} cy={6} r={2} className="fill-success circle-twinkle" />
      <path d="M44 14 H52 M44 18 H52" className="stroke-line-strong" strokeWidth={1} />
    </g>
  );
}

/** A thread from a host to a friend, curved a little so the circle looks woven. */
function Thread({ from, to, bend = 0.12 }: { from: [number, number]; to: [number, number]; bend?: number }) {
  const [x1, y1] = from;
  const [x2, y2] = to;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  // start at the edge of the host's circle and stop at the edge of the friend's window
  const sx = x1 + (dx / len) * 66;
  const sy = y1 + (dy / len) * 66;
  const ex = x2 - (dx / len) * (PORTAL + 4);
  const ey = y2 - (dy / len) * (PORTAL + 4);
  const mx = (sx + ex) / 2 - dy * bend;
  const my = (sy + ey) / 2 + dx * bend;
  const d = `M${sx.toFixed(1)} ${sy.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
  return (
    <g fill="none" strokeLinecap="round">
      <path d={d} className="stroke-blush-deep/25" strokeWidth={6} />
      <path d={d} className="stroke-blush circle-thread" strokeWidth={2} strokeDasharray="3 9" />
    </g>
  );
}

/** Places `n` friends evenly on an oval around (cx, cy), starting at the top. */
function around(n: number, cx: number, cy: number, rx: number, ry: number, start = -90): [number, number][] {
  return Array.from({ length: n }, (_, i) => {
    const a = ((start + (360 / n) * i) * Math.PI) / 180;
    return [Math.round(cx + rx * Math.cos(a)), Math.round(cy + ry * Math.sin(a))];
  });
}

function Frame({ label, children, seed }: { label: string; children: React.ReactNode; seed: number }) {
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full h-auto rounded-card border border-line">
      <Sky seed={seed} />
      {children}
    </svg>
  );
}

// ─── the four pictures ───────────────────────────────────────────────────────

/** The Feathered edition: one person alone with their laptop, inside a closed circle, with nothing reaching in or out. */
export function FeatheredAlone() {
  const f = FRIENDS[1];
  const c: [number, number] = [W / 2, H / 2];
  return (
    <Frame seed={1} label="One person sits alone at their laptop inside a closed, glowing circle under the moon and stars. A single feather floats beside them and a small padlock sits on the circle. No threads lead in or out, and nobody else is there.">
      <circle cx={c[0]} cy={c[1]} r={150} className="fill-tone-700/15" />
      <circle cx={c[0]} cy={c[1]} r={150} fill="none" className="stroke-blush-deep" strokeWidth={2.5} />
      <circle cx={c[0]} cy={c[1]} r={138} fill="none" className="stroke-blush-deep/60" strokeWidth={1.2} strokeDasharray="1 8" strokeLinecap="round" />
      {[0, 72, 144, 216, 288].map((a) => (
        <g key={a} transform={`translate(${c[0]} ${c[1]}) rotate(${a}) translate(0 -150)`}>
          <circle r={7} className="fill-warning/25" />
          <circle r={3} className="fill-warning" />
        </g>
      ))}
      {/* the padlock on the circle */}
      <g transform={`translate(${c[0]} ${c[1] + 150})`}>
        <path d="M-7 -4 V-9 A7 7 0 0 1 7 -9 V-4" fill="none" className="stroke-tone-300" strokeWidth={2.5} />
        <rect x={-10} y={-5} width={20} height={16} rx={3} className="fill-tone-300" />
        <circle cx={0} cy={3} r={2.2} className="fill-canvas" />
      </g>
      <Portal id="cp-feathered" x={c[0]} y={c[1]} f={f} scale={2.2} />
      {/* the feather */}
      <g transform={`translate(${c[0] + 108} ${c[1] - 62}) rotate(35)`} className="circle-twinkle [animation-delay:-11s]">
        <path d="M0 -26 C12 -14 12 10 0 26 C-12 10 -12 -14 0 -26 Z" className="fill-tone-300/80" />
        <path d="M0 -24 V32" className="stroke-tone-500" strokeWidth={1.5} />
        <path d="M0 -10 L7 -15 M0 -2 L8 -7 M0 6 L7 1 M0 -10 L-7 -15 M0 -2 L-8 -7 M0 6 L-7 1" className="stroke-tone-500/60" strokeWidth={1} />
      </g>
    </Frame>
  );
}

/** A small circle: one host and three friends. */
export function SmallCircle() {
  const host: [number, number] = [W / 2, H / 2 + 10];
  const spots = around(3, host[0], host[1] - 10, 250, 150, -90);
  const people = [FRIENDS[0], FRIENDS[2], FRIENDS[3]];
  return (
    <Frame seed={2} label="A small circle. One Winged host computer with little wings sits in the middle, its screen showing the moon. Glowing threads lead from it to three friends in round windows: one on a phone under the midday sun, one with a tablet, one at a desktop computer under the moon.">
      {spots.map((p, i) => <Thread key={i} from={host} to={p} />)}
      <Host x={host[0]} y={host[1]} />
      {spots.map((p, i) => <Portal key={i} id={`cp-small-${i}`} x={p[0]} y={p[1]} f={people[i]} />)}
    </Frame>
  );
}

/** A full circle: one host and nine friends around the world. */
export function FullCircle() {
  const host: [number, number] = [W / 2, H / 2];
  const spots = around(9, host[0], host[1], 290, 168, -90);
  const people = FRIENDS.slice(0, 9);
  return (
    <Frame seed={3} label="A full circle around the world. One Winged host computer sits in the middle, ringed with candle-lights. Threads run out to nine friends in round windows, some under the sun and some under the moon because it is a different time where each one lives. They use phones, tablets, laptops and desktop computers.">
      {spots.map((p, i) => <Thread key={i} from={host} to={p} bend={i % 2 ? 0.1 : -0.1} />)}
      <Host x={host[0]} y={host[1]} />
      {spots.map((p, i) => <Portal key={i} id={`cp-full-${i}`} x={p[0]} y={p[1]} f={people[i]} />)}
    </Frame>
  );
}

/** Two hosts, each with their own circle, and one friend who belongs to both. */
export function TwoHosts() {
  const left: [number, number] = [210, 250];
  const right: [number, number] = [510, 250];
  const both: [number, number] = [W / 2, 62];
  const leftSpots: [number, number][] = [[62, 110], [56, 290], [170, 392]];
  const rightSpots: [number, number][] = [[658, 110], [664, 290], [550, 392]];
  const leftPeople = [FRIENDS[4], FRIENDS[5], FRIENDS[6]];
  const rightPeople = [FRIENDS[7], FRIENDS[8], FRIENDS[10]];
  return (
    <Frame seed={4} label="Two circles side by side. Each has its own Winged host computer with wings, and threads to three friends of its own. The two hosts are not joined to each other. One friend at the top, with a desktop computer, has a thread to each host, because they belong to both circles.">
      {leftSpots.map((p, i) => <Thread key={`l${i}`} from={left} to={p} />)}
      {rightSpots.map((p, i) => <Thread key={`r${i}`} from={right} to={p} bend={-0.12} />)}
      <Thread from={left} to={both} bend={0.08} />
      <Thread from={right} to={both} bend={-0.08} />
      <Host x={left[0]} y={left[1]} />
      <Host x={right[0]} y={right[1]} />
      {leftSpots.map((p, i) => <Portal key={`l${i}`} id={`cp-two-l${i}`} x={p[0]} y={p[1]} f={leftPeople[i]} />)}
      {rightSpots.map((p, i) => <Portal key={`r${i}`} id={`cp-two-r${i}`} x={p[0]} y={p[1]} f={rightPeople[i]} />)}
      <Portal id="cp-two-both" x={both[0]} y={both[1]} f={FRIENDS[11]} />
    </Frame>
  );
}
