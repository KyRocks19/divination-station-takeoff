import { query, queryOne } from "./db";
import { createLayout, type LayoutInput } from "./layouts";

// The app's four starting tarot spreads (the preset rows of the old `spreads` table) are given to each person as
// their own ordinary layouts, which they can change or delete. The Celtic Cross keeps the board it was always drawn
// on, so it is also the example of how to place positions on a board.

/** Where each Celtic Cross position sits on the board, in board units; the second card lies across the first. */
export const CELTIC_CROSS_PLACES: { x: number; y: number; rotation: number }[] = [
  { x: 228, y: 316, rotation: 0 }, // Heart of the Matter
  { x: 228, y: 316, rotation: 90 }, // Crossing It, across the first
  { x: 228, y: 562, rotation: 0 }, // Root
  { x: 54, y: 316, rotation: 0 }, // Past
  { x: 228, y: 70, rotation: 0 }, // Crown
  { x: 402, y: 316, rotation: 0 }, // Future
  { x: 592, y: 600, rotation: 0 }, // Self
  { x: 592, y: 404, rotation: 0 }, // Environment
  { x: 592, y: 210, rotation: 0 }, // Guidance
  { x: 592, y: 10, rotation: 0 }, // Outcome
];

interface PresetRow {
  name: string;
  description: string | null;
  positions: string;
}

interface PresetSpread {
  name: string;
  description: string | null;
  positions: { name: string; description?: string; color?: string }[];
}

/**
 * The same four spreads that `scripts/migrate.ts` writes to the `spreads` table. A local copy's embedded database never
 * runs that script, so its `spreads` table is empty and these are used instead: without them a new person there would
 * have no layout to draw with.
 */
export const STARTING_SPREADS: PresetSpread[] = [
  {
    name: "Past | Present | Future",
    description: "A classic three-card spread revealing temporal flow.",
    positions: [
      { name: "Past", description: "What has led to the current situation", color: "#38bdf8" },
      { name: "Present", description: "The current state of affairs", color: "#f59e0b" },
      { name: "Future", description: "Where things are heading", color: "#10b981" },
    ],
  },
  {
    name: "Situation | Challenge | Advice | Outcome",
    description: "A four-card spread for practical guidance.",
    positions: [
      { name: "Situation", description: "The current situation or context", color: "#a855f7" },
      { name: "Challenge", description: "The main obstacle or difficulty", color: "#f43f5e" },
      { name: "Advice", description: "Guidance on how to proceed", color: "#10b981" },
      { name: "Outcome", description: "The likely outcome if advice is followed", color: "#f59e0b" },
    ],
  },
  {
    name: "Celtic Cross",
    description: "The classic ten-card spread for in-depth readings.",
    positions: [
      { name: "Heart of the Matter", description: "The central energy or core of the situation", color: "#a855f7" },
      { name: "Crossing It", description: "What crosses or challenges the heart of the matter", color: "#f59e0b" },
      { name: "Root of the Issue", description: "The underlying foundation or origin of the situation", color: "#94a3b8" },
      { name: "Past Influence", description: "Recent events or energies that are passing away", color: "#38bdf8" },
      { name: "Present Influence", description: "What crowns you — conscious goals or best possible outcome", color: "#fbbf24" },
      { name: "Future Opportunity", description: "What is coming into being in the near future", color: "#10b981" },
      { name: "Self", description: "Your own attitude, inner state, or how you see yourself", color: "#6366f1" },
      { name: "Environment", description: "External influences — how others see you or what surrounds you", color: "#14b8a6" },
      { name: "Guidance", description: "Your hopes, fears, or the deeper wisdom available to you", color: "#e879f9" },
      { name: "Outcome", description: "The final outcome if the current path continues", color: "#fb923c" },
    ],
  },
  {
    name: "Single Card",
    description: "One card for daily guidance or a simple yes/no question.",
    positions: [
      { name: "Card", description: "Your card for the day or question", color: "#a855f7" },
    ],
  },
];

/**
 * Gives a person their own copies of the starting spreads, once. Safe to call again: it does nothing after the first
 * time, and does nothing if the person already has a layout of the same name (so a layout they made is never doubled).
 */
export async function addStarterLayouts(userId: number): Promise<number> {
  const user = await queryOne<{ starter_layouts: boolean }>("SELECT starter_layouts FROM users WHERE id = $1", [userId]);
  if (!user || user.starter_layouts) return 0;
  const rows = await query<PresetRow>("SELECT name, description, positions FROM spreads WHERE is_preset = 1 ORDER BY id");
  const presets: PresetSpread[] = rows.length
    ? rows.map((r) => ({ name: r.name, description: r.description, positions: JSON.parse(r.positions) }))
    : STARTING_SPREADS;
  const existing = new Set(
    (await query<{ name: string }>("SELECT name FROM layouts WHERE user_id = $1", [userId])).map((r) => r.name)
  );
  let made = 0;
  for (const preset of presets) {
    if (existing.has(preset.name)) continue;
    const raw = preset.positions;
    const board = preset.name === "Celtic Cross" && raw.length === CELTIC_CROSS_PLACES.length;
    const input: LayoutInput = {
      name: preset.name,
      description: preset.description,
      question: null,
      positions: raw.map((p, i) => ({
        name: p.name,
        prompt: p.description || null,
        color: p.color ?? null,
        x: board ? CELTIC_CROSS_PLACES[i].x : null,
        y: board ? CELTIC_CROSS_PLACES[i].y : null,
        rotation: board ? CELTIC_CROSS_PLACES[i].rotation : null,
      })),
    };
    await createLayout(userId, input);
    made++;
  }
  await query("UPDATE users SET starter_layouts = TRUE WHERE id = $1", [userId]);
  return made;
}
