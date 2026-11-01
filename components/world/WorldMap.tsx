"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GRATICULE_PATH, LAND_PATH, MAP_HEIGHT, MAP_WIDTH, SEA_PATH, project } from "@/lib/world-map-data";
import {
  MAX_ZOOM,
  WHOLE_GLOBE,
  ZOOM_STEP,
  clampView,
  panBy,
  pinchFactor,
  pixelsToMap,
  screenToMap,
  viewSize,
  zoomAt,
  zoomWords,
  type View,
} from "@/lib/world-map-view";
import { CERTAINTY_LABELS, TOOL_ORIGINS, type ToolOrigin } from "@/lib/tool-origins";
import { DIVINATION_KIND_LABELS, DIVINATION_KIND_LIBRARY, DIVINATION_KIND_PAGES } from "@/lib/divination-kinds";
import { Card } from "@/components/ui/Card";
import { Button, ButtonLink } from "@/components/ui/Button";
import Cite from "@/components/sources/Cite";
import { KINDS_WITHOUT_GUIDE, type ToolGuideId } from "@/lib/sources";
import Styled from "@/components/ui/Styled";

/** The finer map file: every country as one path, and the lakes (public/world/countries-50m.json, made by scripts/build-world-map.ts from Natural Earth). */
interface Detail {
  countries: { n: string; a: string; d: string }[];
  lakes: string;
}

const DETAIL_URL = "/world/countries-50m.json";
/** How far a finger or the mouse must move before it counts as a drag, not a tap or a click. */
const DRAG_START_PX = 5;
/** How long the pointer (or the keyboard focus) must rest on a point before its tool's name is shown beside it. */
const POINT_LABEL_DELAY_MS = 1000;

/**
 * A map of the world with a point where each tool began, as far as anyone can tell. A point (or its button below the map)
 * opens a short note on the place, the date, and how sure that is, with the sources and links to the tool and to the
 * person's own library for it. The picture, the points, and the notes all use the person's colours. The buttons below the
 * map do everything the points do, for keyboards, screen readers, and small screens.
 *
 * It starts with the whole globe in view. It can be zoomed (two fingers, Ctrl and the wheel or a touchpad pinch, a double click or tap, or the buttons) and
 * moved by dragging or the arrow keys. The finer coastlines and country borders come from Natural Earth (public domain) and load only when the map comes
 * near the screen; until then, or if they cannot be loaded, the plain hand-drawn outline is shown. Pointing at a country shows its name: that is for people
 * with a pointer, and the points and buttons never depend on it.
 */
export default function WorldMap() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [view, setView] = useState<View>(WHOLE_GLOBE);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [country, setCountry] = useState<{ name: string; x: number; y: number } | null>(null);
  const [said, setSaid] = useState("");
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [tip, setTip] = useState<{ id: string; label: string; x: number; y: number } | null>(null);
  const tipTimer = useRef<number | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const viewRef = useRef(view);
  viewRef.current = view;
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const drag = useRef<{ id: number; startX: number; startY: number; started: boolean } | null>(null);
  const justDragged = useRef(false);
  const selected = TOOL_ORIGINS.find((o) => o.id === selectedId) ?? null;
  const k = view.k;
  const size = viewSize(view);

  function choose(o: ToolOrigin) {
    if (justDragged.current) return;
    setSelectedId((cur) => (cur === o.id ? null : o.id));
  }

  /** Changes the view and says what it is now, for a screen reader. */
  const change = useCallback((next: View, say = true) => {
    const v = clampView(next);
    setView(v);
    // A point's label is placed where the point was; once the map moves it would be in the wrong place.
    setTip(null);
    if (say) setSaid(zoomWords(v));
  }, []);

  // The finer map is fetched once, when the map is near the screen. A failure just leaves the plain outline.
  useEffect(() => {
    const el = wrap.current;
    if (!el || detail) return;
    let live = true;
    const load = () =>
      fetch(DETAIL_URL)
        .then((r) => (r.ok ? (r.json() as Promise<Detail>) : null))
        .then((d) => { if (live && d && Array.isArray(d.countries)) setDetail(d); })
        .catch(() => {});
    if (typeof IntersectionObserver === "undefined") {
      load();
      return () => { live = false; };
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          io.disconnect();
          load();
        }
      },
      { rootMargin: "400px" }
    );
    io.observe(el);
    return () => {
      live = false;
      io.disconnect();
    };
  }, [detail]);

  // A turn of the wheel with Ctrl (or Command) held, and a pinch on a touchpad, zoom the map. Without Ctrl the wheel scrolls the page as it always did.
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    function onWheel(e: WheelEvent) {
      if (!e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const box = el!.getBoundingClientRect();
      const [mx, my] = screenToMap(viewRef.current, e.clientX, e.clientY, box);
      change(zoomAt(viewRef.current, Math.exp(-e.deltaY * 0.01), mx, my), false);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [change]);

  function onPointerDown(e: React.PointerEvent<SVGSVGElement>) {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) drag.current = { id: e.pointerId, startX: e.clientX, startY: e.clientY, started: false };
  }

  function onPointerMove(e: React.PointerEvent<SVGSVGElement>) {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const box = e.currentTarget.getBoundingClientRect();
    const now = { x: e.clientX, y: e.clientY };
    const v = viewRef.current;
    if (pointers.current.size >= 2) {
      // Two fingers: spread or pinch to zoom around the middle between them, and move with the middle.
      const [a, b] = [...pointers.current.entries()];
      const before = [a[1], b[1]];
      pointers.current.set(e.pointerId, now);
      const after = [pointers.current.get(a[0])!, pointers.current.get(b[0])!];
      const mid0 = { x: (before[0].x + before[1].x) / 2, y: (before[0].y + before[1].y) / 2 };
      const mid1 = { x: (after[0].x + after[1].x) / 2, y: (after[0].y + after[1].y) / 2 };
      const [mx, my] = screenToMap(v, mid0.x, mid0.y, box);
      let next = zoomAt(v, pinchFactor(before, after), mx, my);
      next = panBy(next, -pixelsToMap(next, mid1.x - mid0.x, box.width), -pixelsToMap(next, mid1.y - mid0.y, box.width));
      if (drag.current) drag.current.started = true;
      justDragged.current = true;
      change(next, false);
      return;
    }
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.started && Math.hypot(now.x - d.startX, now.y - d.startY) < DRAG_START_PX) return;
    // Only a zoomed-in map can be dragged: at the whole globe there is nowhere to go, and one finger should still scroll the page.
    if (v.k <= 1.0001) return;
    if (!d.started) {
      d.started = true;
      e.currentTarget.setPointerCapture(e.pointerId);
    }
    justDragged.current = true;
    pointers.current.set(e.pointerId, now);
    setCountry(null);
    change(panBy(v, -pixelsToMap(v, now.x - prev.x, box.width), -pixelsToMap(v, now.y - prev.y, box.width)), false);
  }

  function onPointerEnd(e: React.PointerEvent<SVGSVGElement>) {
    pointers.current.delete(e.pointerId);
    if (drag.current?.id === e.pointerId) drag.current = null;
    if (pointers.current.size === 0) {
      // A drag ends with a click on whatever is under the finger: that click is not a choice.
      window.setTimeout(() => { justDragged.current = false; }, 0);
      setSaid(zoomWords(viewRef.current));
    }
  }

  function onDoubleClick(e: React.MouseEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    const [mx, my] = screenToMap(viewRef.current, e.clientX, e.clientY, box);
    change(zoomAt(viewRef.current, 2, mx, my));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target !== e.currentTarget || e.ctrlKey || e.metaKey || e.altKey) return;
    const v = viewRef.current;
    const step = size.w * 0.2;
    const centre = [v.x + size.w / 2, v.y + size.h / 2] as const;
    if (e.key === "+" || e.key === "=") change(zoomAt(v, ZOOM_STEP, ...centre));
    else if (e.key === "-" || e.key === "_") change(zoomAt(v, 1 / ZOOM_STEP, ...centre));
    else if (e.key === "0") change(WHOLE_GLOBE);
    else if (e.key === "ArrowLeft") change(panBy(v, -step, 0), false);
    else if (e.key === "ArrowRight") change(panBy(v, step, 0), false);
    else if (e.key === "ArrowUp") change(panBy(v, 0, -step), false);
    else if (e.key === "ArrowDown") change(panBy(v, 0, step), false);
    else return;
    e.preventDefault();
  }

  const zoomIn = () => change(zoomAt(view, ZOOM_STEP, view.x + size.w / 2, view.y + size.h / 2));
  const zoomOut = () => change(zoomAt(view, 1 / ZOOM_STEP, view.x + size.w / 2, view.y + size.h / 2));

  /** The pointer or the focus came to a point: it is highlighted at once, and after a second its tool's name is shown beside it. */
  function restOn(o: ToolOrigin, el: SVGGElement) {
    if (tipTimer.current !== null) window.clearTimeout(tipTimer.current);
    setHoverId(o.id);
    setTip(null);
    setCountry(null);
    tipTimer.current = window.setTimeout(() => {
      tipTimer.current = null;
      const box = wrap.current?.getBoundingClientRect();
      if (!box || !el.isConnected) return;
      const dot = el.getBoundingClientRect();
      setTip({ id: o.id, label: o.label, x: dot.left + dot.width / 2 - box.left, y: dot.top - box.top });
    }, POINT_LABEL_DELAY_MS);
  }

  function leavePoint() {
    if (tipTimer.current !== null) window.clearTimeout(tipTimer.current);
    tipTimer.current = null;
    setHoverId(null);
    setTip(null);
  }

  useEffect(() => () => { if (tipTimer.current !== null) window.clearTimeout(tipTimer.current); }, []);

  function point(e: React.PointerEvent, name: string) {
    if (e.pointerType === "touch") return;
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    setCountry({ name, x: e.clientX - box.left, y: e.clientY - box.top });
  }

  // The land is the only part that depends on the finer map, so it is made once and kept while the person moves around.
  const land = useMemo(
    () =>
      detail ? (
        <>
          {detail.countries.map((c) => (
            <path
              key={c.a + c.n}
              d={c.d}
              strokeWidth={0.7}
              strokeLinejoin="round"
              vectorEffect="non-scaling-stroke"
              onPointerEnter={(e) => point(e, c.n)}
              onPointerMove={(e) => point(e, c.n)}
              onPointerLeave={() => setCountry(null)}
              className="[fill:color-mix(in_oklab,var(--color-blush-deep)_9%,var(--color-surface))] hover:[fill:color-mix(in_oklab,var(--color-blush-deep)_22%,var(--color-surface))] [stroke:var(--color-line)]"
            />
          ))}
          <path d={detail.lakes} strokeWidth={0.6} vectorEffect="non-scaling-stroke" className="[fill:var(--color-surface-sunken)] [stroke:var(--color-line)]" />
        </>
      ) : (
        <>
          <path d={LAND_PATH} strokeWidth={0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="[fill:color-mix(in_oklab,var(--color-blush-deep)_9%,var(--color-surface))] [stroke:var(--color-line-strong)]" />
          <path d={SEA_PATH} strokeWidth={0.8} strokeLinejoin="round" vectorEffect="non-scaling-stroke" className="[fill:var(--color-surface-sunken)] [stroke:var(--color-line)]" />
        </>
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [detail]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-end gap-2" role="group" aria-label="Zoom the map">
        <span role="status" className="text-xs text-ink-faint mr-auto">{said}</span>
        <Button variant="quiet" onClick={zoomOut} disabled={k <= 1.0001} aria-label="Zoom out" className="min-w-11">
          <span aria-hidden="true">−</span>
        </Button>
        <Button variant="quiet" onClick={zoomIn} disabled={k >= MAX_ZOOM - 0.0001} aria-label="Zoom in" className="min-w-11">
          <span aria-hidden="true">+</span>
        </Button>
        <Button variant="quiet" onClick={() => change(WHOLE_GLOBE)} disabled={k <= 1.0001}>
          Whole world
        </Button>
      </div>

      <div
        ref={wrap}
        tabIndex={0}
        role="group"
        aria-label="The map. Press plus or minus to zoom, the arrow keys to move when zoomed in, and zero to see the whole world."
        onKeyDown={onKeyDown}
        className="relative rounded-card focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg
          ref={svg}
          viewBox={`${view.x} ${view.y} ${size.w} ${size.h}`}
          className={`w-full h-auto rounded-card border border-line [background:var(--color-surface-sunken)] select-none ${k > 1.0001 ? "touch-none cursor-grab active:cursor-grabbing" : "touch-pan-y"}`}
          role="group"
          aria-label="A map of the world with a point where each tool began. The points are small on a phone: the buttons below the map do the same, with bigger targets."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
          onDoubleClick={onDoubleClick}
        >
          <path d={GRATICULE_PATH} fill="none" strokeWidth={0.6} vectorEffect="non-scaling-stroke" className="[stroke:var(--color-line-faint)]" />
          {land}

          {TOOL_ORIGINS.map((o) => {
            const [x, y] = project(o.lon, o.lat);
            const on = o.id === selectedId;
            const lit = o.id === hoverId;
            return (
              <g
                key={o.id}
                role="button"
                tabIndex={0}
                aria-pressed={on}
                aria-label={`${o.label}: ${o.place}, ${o.when}`}
                onClick={() => choose(o)}
                onPointerEnter={(e) => { if (e.pointerType !== "touch") restOn(o, e.currentTarget); }}
                onPointerLeave={leavePoint}
                onFocus={(e) => { if (e.currentTarget.matches(":focus-visible")) restOn(o, e.currentTarget); }}
                onBlur={leavePoint}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    choose(o);
                  }
                }}
                className="cursor-pointer"
              >
                {/* A larger invisible circle makes the point easier to press. Sizes are divided by the zoom so a point stays the same size on the screen. */}
                <circle cx={x} cy={y} r={13 / k} fill="transparent" />
                {lit && <circle cx={x} cy={y} r={12 / k} className="[fill:color-mix(in_oklab,var(--color-blush)_35%,transparent)]" />}
                {o.certainty === "uncertain" && (
                  <circle cx={x} cy={y} r={(on ? 11 : 9) / k} fill="none" strokeWidth={1.4} strokeDasharray="3 2.5" vectorEffect="non-scaling-stroke" className="[stroke:var(--color-blush)]" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={(on || lit ? 6.5 : 4.8) / k}
                  strokeWidth={lit ? 2.2 : 1.6}
                  vectorEffect="non-scaling-stroke"
                  className={`${lit ? "[stroke:var(--color-ink-strong)]" : "[stroke:var(--color-blush)]"} ${on || lit ? "[fill:var(--color-blush)]" : "[fill:var(--color-blush-deep)]"}`}
                />
                {on && (
                  <text
                    x={x + 12 / k}
                    y={y + 4.5 / k}
                    fontSize={15 / k}
                    fontWeight={600}
                    strokeWidth={3.5 / k}
                    className="[fill:var(--color-ink-strong)] [stroke:var(--color-canvas)] [paint-order:stroke]"
                  >
                    {o.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {country && (
          // Pointing at a country: its name, near the pointer. Only for people with a pointer; nothing on the page depends on it.
          <Styled
            aria-hidden="true"
            className="pointer-events-none absolute z-10 max-w-[10rem] rounded-control border border-line-strong bg-surface px-2 py-1 text-xs text-ink-strong shadow"
            css={{ left: `${Math.max(0, Math.min(country.x + 12, (wrap.current?.clientWidth ?? 400) - 160))}px`, top: `${Math.max(0, country.y - 30)}px` }}
          >
            {country.name}
          </Styled>
        )}
        {tip && tip.id === hoverId && tip.id !== selectedId && (
          // Resting on a point: its tool's name, just above it. The point's own label already says this to a screen reader.
          <Styled
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-control border border-line-strong bg-surface px-2 py-1 text-sm font-semibold text-ink-strong shadow"
            css={{
              left: `${Math.max(48, Math.min(tip.x, (wrap.current?.clientWidth ?? 400) - 48))}px`,
              top: `${Math.max(32, tip.y - 6)}px`,
            }}
          >
            {tip.label}
          </Styled>
        )}
      </div>

      <p className="text-xs text-ink-ghost text-center">
        Zoom with the buttons, two fingers, a double click, or Ctrl and the wheel. Drag to move when zoomed in. Point at a country to see its name, or rest on a point to see which tool it is.
        {detail && " Coastlines and borders: Made with Natural Earth (public domain)."}
      </p>

      <ul className="flex flex-wrap gap-2 list-none p-0" aria-label="Where each tool began">
        {TOOL_ORIGINS.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => choose(o)}
              aria-pressed={o.id === selectedId}
              className={`text-sm rounded-full px-3 py-1 min-h-11 sm:min-h-0 border transition-colors ${
                o.id === selectedId
                  ? "border-line-hover text-heading bg-surface"
                  : "border-line-strong text-ink-muted hover:border-line-hover hover:text-ink-strong"
              }`}
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>

      {selected ? (
        <Card className="space-y-3" role="region" aria-label={`About ${selected.label}`}>
          <div>
            <h3 className="text-lg font-semibold text-heading">{selected.label}</h3>
            <p className="text-sm text-ink-soft mt-0.5">
              {selected.place} · {selected.when}
            </p>
            <p className="text-xs text-ink-faint mt-1">{CERTAINTY_LABELS[selected.certainty]}</p>
          </div>
          <p className="text-sm text-ink-muted leading-relaxed">{selected.note}</p>
          <div className="flex flex-wrap gap-3">
            <ButtonLink href={DIVINATION_KIND_PAGES[selected.kind]} variant="primary">
              Open {DIVINATION_KIND_LABELS[selected.kind]}
            </ButtonLink>
            <ButtonLink href={DIVINATION_KIND_LIBRARY[selected.kind]} variant="quiet">
              Your library for it
            </ButtonLink>
          </div>
          {/* A tool with no sources page of its own (tasseomancy, ink blots) has nowhere for the markers to open; its sources are listed below. */}
          {!(KINDS_WITHOUT_GUIDE as readonly string[]).includes(selected.kind) && (
            <Cite topic={`origin.${selected.id}`} tool={selected.kind as ToolGuideId} className="text-xs text-ink-faint leading-relaxed" />
          )}
          <div className="space-y-1">
            <p className="text-[10px] text-ink-faint uppercase tracking-widest">Sources</p>
            <ul className="list-disc pl-5 space-y-0.5">
              {selected.sources.map((s) => (
                <li key={s.url} className="text-xs text-ink-faint break-words">
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-block min-h-6 py-0.5 hover:text-accent-ink">
                    {s.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      ) : (
        <p className="text-sm text-ink-faint text-center">
          Press a point on the map, or one of the buttons, to read about where it began. A dashed ring means the origin is
          uncertain.
        </p>
      )}
    </div>
  );
}
