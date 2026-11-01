"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { SUIT_META } from "@/lib/suit-meta";
import { styleRef } from "@/lib/apply-style";

type Polarity = "all" | "upright" | "reversed";

interface ConceptNode {
  id: number;
  name: string;
  display_name: string;
  card_count: number;
  dominant_suit?: string;
}

interface CardNode {
  card_id: string;
  card_name: string;
  suit: string;
}

interface GraphData {
  concepts: ConceptNode[];
  cards: CardNode[];
  edges: { card_id: string; concept_id: number; reversed: boolean }[];
}

interface Props {
  data: GraphData;
  suitFilter?: string | null;
  polarity?: Polarity;
}

interface Node {
  id: string;
  label: string;
  type: "concept" | "card";
  suit?: string;
  /** For concept nodes: true = only appears via reversed edges in current view */
  reversedOnly?: boolean;
  size: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx?: number;
  fy?: number;
}

interface Edge {
  source: string;
  target: string;
  reversed: boolean;
}

const W = 900;
const H = 650;

function buildNodes(
  data: GraphData,
  polarity: Polarity
): { nodes: Node[]; edges: Edge[] } {
  // Filter edges to the active polarity
  const filteredEdges = polarity === "all"
    ? data.edges
    : data.edges.filter((e) => (polarity === "reversed") === e.reversed);

  // Count filtered edges per concept to pick the top visible ones
  const conceptEdgeCount = new Map<number, number>();
  for (const e of filteredEdges) {
    conceptEdgeCount.set(e.concept_id, (conceptEdgeCount.get(e.concept_id) ?? 0) + 1);
  }

  // Top 60 concepts by number of edges in this polarity view
  const topConcepts = [...data.concepts]
    .filter((c) => conceptEdgeCount.has(c.id))
    .sort((a, b) => (conceptEdgeCount.get(b.id) ?? 0) - (conceptEdgeCount.get(a.id) ?? 0))
    .slice(0, 60);
  const conceptIds = new Set(topConcepts.map((c) => c.id));

  const relevantEdges = filteredEdges.filter((e) => conceptIds.has(e.concept_id));
  const relevantCardIds = new Set(relevantEdges.map((e) => e.card_id));

  // When showing "all", track which concepts appear ONLY via reversed edges
  const uprightConceptIds = new Set(
    data.edges.filter((e) => !e.reversed).map((e) => e.concept_id)
  );

  const angle = (i: number, total: number) => (2 * Math.PI * i) / total - Math.PI / 2;
  const nodes: Node[] = [];
  const edges: Edge[] = [];

  const cards = data.cards.filter((c) => relevantCardIds.has(c.card_id));
  cards.forEach((c, i) => {
    const a = angle(i, cards.length);
    nodes.push({
      id: `card:${c.card_id}`,
      label: c.card_name,
      type: "card",
      suit: c.suit,
      size: 6,
      x: W / 2 + 260 * Math.cos(a) + (Math.random() - 0.5) * 20,
      y: H / 2 + 220 * Math.sin(a) + (Math.random() - 0.5) * 20,
      vx: 0,
      vy: 0,
    });
  });

  topConcepts.forEach((c, i) => {
    const a = angle(i, topConcepts.length);
    const count = conceptEdgeCount.get(c.id) ?? 1;
    const maxCount = conceptEdgeCount.get(topConcepts[0].id) ?? 1;
    const r = 60 + (count / maxCount) * 100;
    nodes.push({
      id: `concept:${c.id}`,
      label: c.display_name,
      type: "concept",
      suit: c.dominant_suit,
      reversedOnly: !uprightConceptIds.has(c.id),
      size: 3 + Math.min(count * 1.2, 10),
      x: W / 2 + r * 0.5 * Math.cos(a) + (Math.random() - 0.5) * 30,
      y: H / 2 + r * 0.4 * Math.sin(a) + (Math.random() - 0.5) * 30,
      vx: 0,
      vy: 0,
    });
  });

  for (const e of relevantEdges) {
    edges.push({
      source: `card:${e.card_id}`,
      target: `concept:${e.concept_id}`,
      reversed: e.reversed,
    });
  }

  return { nodes, edges };
}

export default function ConceptGraph({ data, suitFilter, polarity = "all" }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const animRef = useRef<number>(0);
  const dragRef = useRef<{ node: Node; ox: number; oy: number; startWx: number; startWy: number; hasDragged: boolean } | null>(null);
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const panRef = useRef<{ dragging: boolean; sx: number; sy: number; px: number; py: number }>({
    dragging: false, sx: 0, sy: 0, px: 0, py: 0,
  });
  const [resetKey, setResetKey] = useState(0);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Rebuild nodes when data or polarity changes
  useEffect(() => {
    const { nodes, edges } = buildNodes(data, polarity);
    nodesRef.current = nodes;
    edgesRef.current = edges;

    fetch("/api/encyclopedia/graph-positions")
      .then((r) => (r.ok ? r.json() : {}))
      .then((saved: Record<string, { x: number; y: number }>) => {
        for (const n of nodesRef.current) {
          const pos = saved[n.id];
          if (pos) {
            n.x = pos.x;
            n.y = pos.y;
            n.fx = pos.x;
            n.fy = pos.y;
            n.vx = 0;
            n.vy = 0;
          }
        }
      })
      .catch(() => {});
  }, [data, polarity, resetKey]);

  function savePositions() {
    const positions: Record<string, { x: number; y: number }> = {};
    for (const n of nodesRef.current) {
      positions[n.id] = { x: Math.round(n.x), y: Math.round(n.y) };
    }
    setSaveStatus("saving");
    fetch("/api/encyclopedia/graph-positions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(positions),
    })
      .then(() => {
        setSaveStatus("saved");
        if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
        saveTimerRef.current = setTimeout(() => setSaveStatus("idle"), 2000);
      })
      .catch(() => setSaveStatus("idle"));
  }

  function handleReset() {
    fetch("/api/encyclopedia/graph-positions", { method: "DELETE" }).catch(() => {});
    setResetKey((k) => k + 1);
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setSaveStatus("idle");
  }

  const simulate = useCallback(() => {
    const nodes = nodesRef.current;
    const edges = edgesRef.current;
    const nodeMap = new Map(nodes.map((n) => [n.id, n]));
    const ALPHA = 0.04;

    for (const n of nodes) {
      if (n.fx !== undefined) { n.x = n.fx; n.y = n.fy!; continue; }
      n.vx += (W / 2 - n.x) * 0.003;
      n.vy += (H / 2 - n.y) * 0.003;

      for (const m of nodes) {
        if (m.id === n.id) continue;
        const dx = n.x - m.x;
        const dy = n.y - m.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const force = Math.min(800 / (dist * dist), 5);
        n.vx += (dx / dist) * force;
        n.vy += (dy / dist) * force;
      }
    }

    for (const e of edges) {
      const a = nodeMap.get(e.source);
      const b = nodeMap.get(e.target);
      if (!a || !b) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 1;
      const target = 90;
      const f = (dist - target) * 0.015;
      const fx = (dx / dist) * f;
      const fy = (dy / dist) * f;
      if (a.fx === undefined) { a.vx += fx; a.vy += fy; }
      if (b.fx === undefined) { b.vx -= fx; b.vy -= fy; }
    }

    for (const n of nodes) {
      if (n.fx !== undefined) continue;
      n.vx *= (1 - ALPHA);
      n.vy *= (1 - ALPHA);
      n.x = Math.max(10, Math.min(W - 10, n.x + n.vx));
      n.y = Math.max(10, Math.min(H - 10, n.y + n.vy));
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let frame = 0;

    function draw() {
      if (frame < 200) simulate();
      frame++;
      // The labels follow the page's colours (a light theme needs dark ones), read each time the graph is drawn.
      const css = getComputedStyle(document.documentElement);
      const labelInk = css.getPropertyValue("--color-ink").trim() || "#e2e8f0";
      const reversedInk = css.getPropertyValue("--color-danger").trim() || "#fda4af";

      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.translate(pan.x, pan.y);
      ctx.scale(zoom, zoom);

      const nodes = nodesRef.current;
      const edges = edgesRef.current;
      const nodeMap = new Map(nodes.map((n) => [n.id, n]));
      const searchLower = search.toLowerCase();

      // ── Draw edges ──────────────────────────────────────────────────────────
      for (const e of edges) {
        const a = nodeMap.get(e.source);
        const b = nodeMap.get(e.target);
        if (!a || !b) continue;

        const suitMatch = !suitFilter || a.suit === suitFilter || b.suit === suitFilter;
        const highlight = suitMatch && (
          hoveredId === a.id || hoveredId === b.id ||
          (searchLower && (a.label.toLowerCase().includes(searchLower) || b.label.toLowerCase().includes(searchLower)))
        );

        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);

        if (e.reversed) {
          ctx.setLineDash([3, 4]);
          ctx.strokeStyle = highlight ? "rgba(244,63,94,0.55)" : "rgba(190,50,80,0.18)";
          ctx.lineWidth = highlight ? 1.2 : 0.6;
        } else {
          ctx.setLineDash([]);
          ctx.strokeStyle = highlight ? "rgba(167,139,250,0.4)" : "rgba(88,80,128,0.15)";
          ctx.lineWidth = highlight ? 1.2 : 0.5;
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // ── Draw nodes ──────────────────────────────────────────────────────────
      for (const n of nodes) {
        const baseColor = SUIT_META[n.suit ?? "major"]?.color ?? "#7c3aed";
        const isHovered = hoveredId === n.id;
        const matchSearch = searchLower && n.label.toLowerCase().includes(searchLower);
        const suitDim = suitFilter && n.suit !== suitFilter;
        const dim = suitDim || (searchLower && !matchSearch && !isHovered);

        ctx.globalAlpha = dim ? 0.15 : 1;

        if (n.type === "card") {
          // Card: filled square
          const s = n.size + 2;
          ctx.beginPath();
          ctx.rect(n.x - s, n.y - s, s * 2, s * 2);
          ctx.fillStyle = isHovered || matchSearch ? baseColor : `${baseColor}88`;
          ctx.fill();
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = isHovered || matchSearch ? 1.5 : 0.5;
          ctx.stroke();
        } else if (n.reversedOnly) {
          // Reversed-only concept: hollow circle with rose tint
          const r = n.size + (isHovered ? 2 : 0);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered || matchSearch ? "rgba(244,63,94,0.22)" : "rgba(190,50,80,0.08)";
          ctx.fill();
          ctx.setLineDash([2, 2]);
          ctx.strokeStyle = isHovered || matchSearch ? "rgba(244,63,94,0.9)" : "rgba(190,50,80,0.55)";
          ctx.lineWidth = isHovered || matchSearch ? 1.5 : 1;
          ctx.stroke();
          ctx.setLineDash([]);
        } else {
          // Upright (or mixed) concept: filled circle
          const r = n.size + (isHovered ? 2 : 0);
          ctx.beginPath();
          ctx.arc(n.x, n.y, r, 0, 2 * Math.PI);
          ctx.fillStyle = isHovered || matchSearch ? baseColor : `${baseColor}88`;
          ctx.fill();
          ctx.strokeStyle = baseColor;
          ctx.lineWidth = isHovered || matchSearch ? 1.5 : 0.5;
          ctx.stroke();
        }

        if (isHovered || matchSearch) {
          ctx.font = `${n.type === "concept" ? "bold " : ""}10px sans-serif`;
          ctx.fillStyle = n.reversedOnly ? reversedInk : labelInk;
          ctx.textAlign = "center";
          ctx.fillText(
            n.label.length > 20 ? n.label.slice(0, 18) + "…" : n.label,
            n.x,
            n.y - n.size - 4
          );
        }
        ctx.globalAlpha = 1;
      }

      ctx.restore();
      animRef.current = requestAnimationFrame(draw);
    }

    animRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animRef.current);
  }, [simulate, search, hoveredId, zoom, pan, suitFilter]);

  function canvasToWorld(cx: number, cy: number) {
    return { x: (cx - pan.x) / zoom, y: (cy - pan.y) / zoom };
  }

  function hitTest(wx: number, wy: number): Node | null {
    let best: Node | null = null;
    let bestDist = 16;
    for (const n of nodesRef.current) {
      const dx = n.x - wx;
      const dy = n.y - wy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < Math.max(n.size + 6, bestDist)) {
        bestDist = dist;
        best = n;
      }
    }
    return best;
  }

  function onMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;

    if (dragRef.current) {
      const { node, ox, oy, startWx, startWy } = dragRef.current;
      const w = canvasToWorld(cx, cy);
      if (Math.abs(w.x - startWx) + Math.abs(w.y - startWy) > 4) {
        dragRef.current.hasDragged = true;
      }
      node.fx = w.x - ox;
      node.fy = w.y - oy;
      node.x = node.fx;
      node.y = node.fy;
      return;
    }

    if (panRef.current.dragging) {
      setPan({
        x: panRef.current.px + cx - panRef.current.sx,
        y: panRef.current.py + cy - panRef.current.sy,
      });
      return;
    }

    const w = canvasToWorld(cx, cy);
    const hit = hitTest(w.x, w.y);
    setHoveredId(hit?.id ?? null);
    canvasRef.current!.style.cursor = hit ? "pointer" : "grab";
  }

  function onMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const w = canvasToWorld(cx, cy);
    const hit = hitTest(w.x, w.y);
    if (hit) {
      dragRef.current = { node: hit, ox: w.x - hit.x, oy: w.y - hit.y, startWx: w.x, startWy: w.y, hasDragged: false };
    } else {
      panRef.current = { dragging: true, sx: cx, sy: cy, px: pan.x, py: pan.y };
    }
  }

  function onMouseUp() {
    if (dragRef.current) {
      const node = dragRef.current.node;
      node.fx = node.x;
      node.fy = node.y;
      node.vx = 0;
      node.vy = 0;
      const wasDrag = dragRef.current.hasDragged;
      dragRef.current = null;
      if (wasDrag) savePositions();
    }
    panRef.current.dragging = false;
  }

  function getHitAtEvent(e: React.MouseEvent<HTMLCanvasElement>): Node | null {
    const rect = canvasRef.current!.getBoundingClientRect();
    const scaleX = W / rect.width;
    const scaleY = H / rect.height;
    const cx = (e.clientX - rect.left) * scaleX;
    const cy = (e.clientY - rect.top) * scaleY;
    const w = canvasToWorld(cx, cy);
    return hitTest(w.x, w.y);
  }

  function onDoubleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const hit = getHitAtEvent(e);
    if (hit?.type === "concept") {
      const name = hit.id.replace("concept:", "");
      const concept = data.concepts.find((c) => String(c.id) === name);
      if (concept) router.push(`/encyclopedia/${encodeURIComponent(concept.name)}`);
    }
    if (hit?.type === "card") {
      const cardId = hit.id.replace("card:", "");
      router.push(`/cards/${encodeURIComponent(cardId)}`);
    }
  }

  function onWheel(e: React.WheelEvent<HTMLCanvasElement>) {
    e.preventDefault();
    setZoom((z) => Math.max(0.3, Math.min(3, z * (e.deltaY > 0 ? 0.9 : 1.1))));
  }

  const polarityLabel = polarity === "reversed" ? "Reversed" : polarity === "upright" ? "Upright" : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <input
          type="text"
          placeholder="Highlight concept…" aria-label="Highlight a concept"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface border border-line-strong text-ink-strong text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-focus w-48"
        />
        {polarityLabel && (
          <span className={`text-[10px] px-2 py-0.5 rounded border ${
            polarity === "reversed"
              ? "text-danger-ink border-danger/25 bg-danger/5"
              : "text-tone-400 border-line-strong bg-tone-900/10"
          }`}>
            {polarityLabel} only
          </span>
        )}
        <span className="text-xs text-ink-ghost">Drag to move · Double-click → card/concept page · Scroll to zoom</span>
        <div className="ml-auto flex items-center gap-2">
          {saveStatus === "saving" && (
            <span className="text-[10px] text-ink-ghost animate-pulse">Saving…</span>
          )}
          {saveStatus === "saved" && (
            <span className="text-[10px] text-tone-500">Layout saved</span>
          )}
          <button
            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            className="text-xs text-ink-faint hover:text-ink-soft transition-colors"
          >
            Reset view
          </button>
          <button
            onClick={handleReset}
            className="text-xs text-danger hover:text-danger-ink transition-colors"
            title="Clear saved positions and re-randomize layout"
          >
            Reset layout
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex gap-4 flex-wrap text-xs text-ink-ghost">
        <span>● upright concept</span>
        <span className="text-danger">◌ reversed concept</span>
        <span>■ card</span>
        {polarity === "all" && (
          <>
            <span className="text-ink-faint">—— upright edge</span>
            <span className="text-danger">╌╌ reversed edge</span>
          </>
        )}
        {Object.entries(SUIT_META).map(([k, v]) => (
          <span key={k} className="text-ink-faint"><span aria-hidden="true" ref={styleRef({ color: v.color })}>●</span> {v.label}</span>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        role="img"
        aria-label="A picture of how the concepts connect, drawn for the mouse. The List view shows the same concepts as links you can reach with a keyboard or a screen reader."
        width={W}
        height={H}
        className="w-full rounded-xl border border-line bg-canvas cursor-grab"
        onMouseMove={onMouseMove}
        onMouseDown={onMouseDown}
        onMouseUp={onMouseUp}
        onDoubleClick={onDoubleClick}
        onWheel={onWheel}
      />
    </div>
  );
}
