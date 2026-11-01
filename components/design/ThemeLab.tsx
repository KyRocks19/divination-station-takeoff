"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CONTRAST_CHECKS,
  LAB_OFF_PARAM,
  LAB_OLD_STORAGE_KEY,
  LAB_TOKENS,
  TEXT_MIX_LIGHT,
  TEXT_MIX_VAR,
  contrastRatio,
  isHex,
  isLightColor,
} from "@/lib/theme-lab-shared";
import { THEME_PALETTES } from "@/lib/themes-data";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { SectionLabel } from "@/components/ui/Page";
import { styleRef } from "@/lib/apply-style";

type Colours = Record<string, string>;
type SaveState = "idle" | "saving" | "saved" | "error";

/** Turns any CSS colour the browser understands (hex, rgb, lab, oklab) into a six-digit hex colour. */
function toHex(cssColor: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 1;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return "#000000";
  ctx.clearRect(0, 0, 1, 1);
  ctx.fillStyle = "#000000";
  ctx.fillStyle = cssColor;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
  return "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** The colour a token has right now, read from a probe element so tokens that point at other tokens resolve. */
function currentHex(name: string): string {
  const probe = document.createElement("span");
  probe.style.color = `var(--${name})`;
  probe.style.display = "none";
  document.body.appendChild(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return toHex(value);
}

/** Puts exactly these colours on the page (and takes the others off), in the browser only. */
function paint(colours: Colours) {
  for (const t of LAB_TOKENS) {
    if (colours[t.name]) document.documentElement.style.setProperty(`--${t.name}`, colours[t.name]);
    else document.documentElement.style.removeProperty(`--${t.name}`);
  }
  // A light page also pulls colours drawn as text toward the ink colour, as the server does for a saved theme (lib/theme.ts).
  const canvas = colours["color-canvas"];
  if (canvas && isLightColor(canvas)) document.documentElement.style.setProperty(TEXT_MIX_VAR, TEXT_MIX_LIGHT);
  else document.documentElement.style.removeProperty(TEXT_MIX_VAR);
}

interface Props {
  /** The colours saved with the person's profile, or null for the app's own. */
  initial: Colours | null;
}

/**
 * The colour lab. Everyone signed in can use it. A choice shows at once and is saved with the person's profile, so it
 * follows them to every page and every device. It starts from eight ready-made themes or from a single colour, warns
 * (and blocks nothing) when two colours that are used together are hard to read, and always has a way back to the app's
 * own colours. "Copy changes as CSS" gives lines to paste into the `@theme` block of app/globals.css.
 */
export default function ThemeLab({ initial }: Props) {
  const [defaults, setDefaults] = useState<Colours>({});
  const [changed, setChanged] = useState<Colours>({});
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [copied, setCopied] = useState(false);
  const [offer, setOffer] = useState<Colours | null>(null);
  // The app's own colours are read from the browser (the page's styles), so nothing that depends on them is drawn until
  // the first effect has run. Drawing it on the server and again in the browser with different values was a hydration
  // mismatch.
  const [ready, setReady] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Colours>({});

  useEffect(() => {
    // The server put the person's colours on the page; take them off to read the app's own, then put them back.
    paint({});
    const own: Colours = {};
    for (const t of LAB_TOKENS) own[t.name] = currentHex(t.name);
    const saved: Colours = {};
    for (const [k, v] of Object.entries(initial ?? {})) if (isHex(v)) saved[k] = v;
    paint(saved);
    setDefaults(own);
    setChanged(saved);
    latest.current = saved;

    // Colours the lab used to keep in this browser only: offered once for saving to the profile.
    try {
      const raw = JSON.parse(window.localStorage.getItem(LAB_OLD_STORAGE_KEY) ?? "{}") as Record<string, unknown>;
      const old: Colours = {};
      for (const t of LAB_TOKENS) if (isHex(raw[t.name])) old[t.name] = raw[t.name] as string;
      if (Object.keys(old).length > 0 && Object.keys(saved).length === 0) setOffer(old);
    } catch {
      // Storage blocked or unreadable: nothing to offer.
    }
    setReady(true);
  }, [initial]);

  const save = useCallback((colours: Colours) => {
    latest.current = colours;
    setSaveState("saving");
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/theme", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ theme: Object.keys(latest.current).length > 0 ? latest.current : null }),
        });
        setSaveState(res.ok ? "saved" : "error");
      } catch {
        setSaveState("error");
      }
    }, 500);
  }, []);

  function apply(next: Colours) {
    // A colour equal to the app's own is not a change.
    const clean: Colours = {};
    for (const [k, v] of Object.entries(next)) if (v.toLowerCase() !== defaults[k]?.toLowerCase()) clean[k] = v.toLowerCase();
    paint(clean);
    setChanged(clean);
    save(clean);
  }

  const values: Colours = { ...defaults, ...changed };
  const count = Object.keys(changed).length;
  const css = Object.entries(changed).map(([n, v]) => `  --${n}: ${v};`).join("\n");

  const colourOf = (key: string) => (key.startsWith("#") ? key : values[key]);
  const hardToRead = CONTRAST_CHECKS.map((c) => {
    const fg = colourOf(c.fg), bg = colourOf(c.bg);
    return { ...c, ratio: fg && bg ? contrastRatio(fg, bg) : 99 };
  }).filter((c) => c.ratio < c.min);

  async function copy() {
    try {
      await navigator.clipboard.writeText(css);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  const groups = [...new Set(LAB_TOKENS.map((t) => t.group))];
  const status = { idle: "", saving: "Saving to your profile…", saved: "Saved to your profile.", error: "Could not save. Your colours still show here; try again." }[saveState];

  return (
    <section aria-labelledby="d-lab" className="space-y-4">
      <SectionLabel id="d-lab">Your colours</SectionLabel>
      <p className="text-sm text-ink-muted leading-relaxed">
        Choose the colours you feel at home with. Start from a theme or pick any colour yourself, and every page changes at
        once. Your choices are saved with your profile, so they follow you to every device. If a choice makes the app hard to
        read, add <code>?{LAB_OFF_PARAM}</code>{" "}to any address to see the app&apos;s own colours, then come back and change it.
      </p>

      {!ready && <p className="text-xs text-ink-faint">Reading the current colours…</p>}

      {ready && (
        <>
          {offer && (
            <Card className="space-y-2">
              <p className="text-sm text-ink-strong">You have colours saved in this browser from before.</p>
              <div className="flex flex-wrap gap-3">
                <Button
                  onClick={() => {
                    apply(offer);
                    try { window.localStorage.removeItem(LAB_OLD_STORAGE_KEY); } catch { /* nothing to remove */ }
                    setOffer(null);
                  }}
                >
                  Save these to your profile
                </Button>
                <Button
                  variant="quiet"
                  onClick={() => {
                    try { window.localStorage.removeItem(LAB_OLD_STORAGE_KEY); } catch { /* nothing to remove */ }
                    setOffer(null);
                  }}
                >
                  Discard them
                </Button>
              </div>
            </Card>
          )}

          <Card className="space-y-3">
            <p className="text-[10px] text-ink-faint uppercase tracking-widest">Themes</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 list-none p-0">
              <li>
                <button
                  type="button"
                  onClick={() => apply({})}
                  className="w-full text-left bg-field border border-line-strong hover:border-line-hover rounded-control p-3 transition-colors"
                >
                  <span className="block text-sm text-ink-strong">The app&apos;s own colours</span>
                  <span className="block text-xs text-ink-faint mt-0.5">Pink and purple, the default for everyone.</span>
                </button>
              </li>
              {THEME_PALETTES.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => apply(p.colors)}
                    className="w-full text-left bg-field border border-line-strong hover:border-line-hover rounded-control p-3 transition-colors"
                  >
                    <span className="flex items-center gap-2">
                      {["color-canvas", "color-surface", "color-blush", "color-blush-deep", "color-accent-ink"].map((k) => (
                        <span key={k} aria-hidden="true" className="h-4 w-4 rounded-full border border-line-strong" ref={styleRef({ background: p.colors[k] })} />
                      ))}
                      <span className="text-sm text-ink-strong">{p.name}</span>
                    </span>
                    <span className="block text-xs text-ink-faint mt-1">{p.description}</span>
                  </button>
                </li>
              ))}
            </ul>
          </Card>

          <div className="flex flex-wrap items-center gap-3">
            <Button variant="quiet" onClick={() => apply({})} disabled={count === 0}>Use the app&apos;s own colours</Button>
            <Button variant="text" onClick={copy} disabled={count === 0}>{copied ? "Copied" : "Copy changes as CSS"}</Button>
            <span className="text-xs text-ink-faint">{count === 0 ? "You are using the app's own colours." : `${count} colour${count === 1 ? "" : "s"} changed.`}</span>
            {status && <span className="text-xs text-ink-muted" role="status">{status}</span>}
            {saveState === "error" && <Button variant="text" onClick={() => save(latest.current)}>Try again</Button>}
          </div>

          {hardToRead.length > 0 && (
            <Card className="space-y-2 border-line-accent" role="status">
              <p className="text-sm text-ink-strong">Some of these colours may be hard to read.</p>
              <ul className="space-y-1 list-none p-0">
                {hardToRead.map((c) => (
                  <li key={c.label} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-muted">
                    <span>{c.label}: {c.ratio.toFixed(1)} to 1 (aim for {c.min} to 1 or more)</span>
                    {!c.fg.startsWith("#") && c.fg in changed && (
                      <Button variant="text" onClick={() => { const next = { ...changed }; delete next[c.fg]; apply(next); }}>
                        Put {LAB_TOKENS.find((t) => t.name === c.fg)?.label.toLowerCase() ?? "this colour"} back
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
              <p className="text-xs text-ink-faint">Nothing is blocked. This is only a warning.</p>
            </Card>
          )}

          {groups.map((group) => (
            <Card key={group} className="space-y-3">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">{group}</p>
              <ul className="space-y-2 list-none p-0">
                {LAB_TOKENS.filter((t) => t.group === group).map((t) => {
                  const value = values[t.name] ?? "#000000";
                  return (
                    <li key={t.name} className="flex flex-wrap items-center gap-3">
                      <input
                        type="color"
                        value={value}
                        onChange={(e) => apply({ ...changed, [t.name]: e.target.value })}
                        aria-label={`${t.label} colour`}
                        className="h-11 sm:h-9 w-12 rounded-control border border-line-strong bg-field p-0.5 cursor-pointer"
                      />
                      <HexBox
                        label={`${t.label} hex value`}
                        value={value}
                        onValid={(hex) => apply({ ...changed, [t.name]: hex })}
                      />
                      <span className="text-sm text-ink-strong">{t.label}</span>
                      {t.name in changed && (
                        <Button variant="text" onClick={() => { const next = { ...changed }; delete next[t.name]; apply(next); }}>Reset</Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ))}

          {count > 0 && (
            <Card className="space-y-2">
              <p className="text-[10px] text-ink-faint uppercase tracking-widest">Paste into the @theme block of app/globals.css</p>
              <pre className="text-xs text-ink-strong whitespace-pre-wrap break-words font-mono">{css}</pre>
            </Card>
          )}
        </>
      )}
    </section>
  );
}

/** A box for typing a hex colour. It applies the colour once what is typed is a whole six-digit colour. */
function HexBox({ label, value, onValid }: { label: string; value: string; onValid: (hex: string) => void }) {
  const [text, setText] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => { if (!editing) setText(value); }, [value, editing]);
  return (
    <input
      type="text"
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        if (isHex(e.target.value)) onValid(e.target.value);
      }}
      onFocus={() => setEditing(true)}
      onBlur={() => { setEditing(false); setText(value); }}
      aria-label={label}
      maxLength={7}
      spellCheck={false}
      className="w-24 min-h-11 sm:min-h-0 bg-field border border-line-strong rounded-control px-2 py-1 text-xs text-ink-strong font-mono focus:outline-none focus:border-focus"
    />
  );
}
