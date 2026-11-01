import type { OwnArchetype, OwnConcept, OwnLink } from "./own-archetypes";
import { getFace } from "./dice-data";
import { getStave } from "./ogham-data";

// A person's own archetypes, concepts and links to pieces, for the data export (JSON and Markdown): the shape and the
// Markdown, with no database code so they can be tested. lib/export-own.ts reads the rows. Only the person's own words
// go in; a link to a shared archetype is exported by its name only, never with the shared archetype's words.

export interface OwnExport {
  own_archetypes: {
    name: string;
    group: string | null;
    summary: string;
    good_side: string;
    hard_side: string;
    made_at: string;
    changed_at: string;
  }[];
  own_concepts: {
    name: string;
    description: string;
    sits_under: { kind: "shared archetype" | "your archetype"; name: string } | null;
    /** The realm the person gave it (migration 101); null when it takes the realm of the archetype it sits under. */
    realm: string | null;
    made_at: string;
    changed_at: string;
  }[];
  own_links: {
    from: { kind: "piece" | "your oracle item"; id: string };
    to: { kind: "shared archetype" | "your archetype" | "your concept"; name: string };
    side: "good side" | "hard side" | "either";
  }[];
  /** The names the person gave to pieces of a tool, such as the sides of a knucklebone (migration 076). */
  own_names: { piece: string; piece_id: string; name: string }[];
  /** The person's cloths and the zones they drew (migration 077), and where items landed on them. The zones' shapes are the person's own drawing. */
  cloths: {
    name: string;
    description: string | null;
    zones: { name: string; note: string | null; color: string | null; shape: string; geometry: unknown }[];
  }[];
  cloth_placements: {
    reading: { id: number; tool: string; made_at: string };
    cloth: string;
    item: string;
    where: string;
    facing: string | null;
    thrown_by_the_app: boolean;
  }[];
}

export interface ClothExportInput {
  cloths: { name: string; description: string | null; zones: { name: string; note: string | null; color: string | null; geom: { shape: string } }[] }[];
  placements: {
    divination_id: number;
    kind: string;
    made_at: string;
    cloth_name: string;
    item_label: string;
    where_kind: "zone" | "none" | "off";
    zone_name: string | null;
    facing: string | null;
    simulated: boolean;
  }[];
}

/** The cloths and placements as the export holds them, in the person's words. Pure. */
export function shapeClothExport(input: ClothExportInput): Pick<OwnExport, "cloths" | "cloth_placements"> {
  return {
    cloths: input.cloths.map((c) => ({
      name: c.name,
      description: c.description,
      zones: c.zones.map((z) => ({ name: z.name, note: z.note, color: z.color, shape: z.geom.shape, geometry: z.geom })),
    })),
    cloth_placements: input.placements.map((p) => ({
      reading: { id: p.divination_id, tool: p.kind, made_at: p.made_at },
      cloth: p.cloth_name,
      item: p.item_label,
      where: p.where_kind === "zone" ? `in ${p.zone_name}` : p.where_kind === "none" ? "on the cloth, in no zone" : "off the cloth",
      facing: p.facing === "up" ? "face up" : p.facing === "down" ? "face down" : null,
      thrown_by_the_app: p.simulated,
    })),
  };
}

const SIDE = { light: "good side", shadow: "hard side", neutral: "either" } as const;
const TARGET = { archetype: "shared archetype", user_archetype: "your archetype", user_concept: "your concept" } as const;

/** Shapes the rows for the export. Pure, so it can be tested; `oracleNames` maps an oracle item's id to its name. */
export function shapeOwnExport(
  archetypes: OwnArchetype[], concepts: OwnConcept[], links: OwnLink[], oracleNames: Map<number, string>, names: Record<string, string> = {},
  cloth: ClothExportInput = { cloths: [], placements: [] }
): OwnExport {
  return {
    ...shapeClothExport(cloth),
    own_names: Object.entries(names)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([piece_id, name]) => ({ piece: getFace(piece_id)?.name ?? (getStave(piece_id) ? `Ogham · ${getStave(piece_id)!.name}` : piece_id), piece_id, name })),
    own_archetypes: archetypes.map((a) => ({
      name: a.name, group: a.realm, summary: a.summary, good_side: a.light, hard_side: a.shadow, made_at: a.created_at, changed_at: a.updated_at,
    })),
    own_concepts: concepts.map((c) => ({
      name: c.name,
      description: c.description,
      sits_under: c.shared_archetype
        ? { kind: "shared archetype", name: c.shared_archetype.name }
        : c.user_archetype ? { kind: "your archetype", name: c.user_archetype.name } : null,
      realm: c.realm,
      made_at: c.created_at,
      changed_at: c.updated_at,
    })),
    own_links: links.map((l) => ({
      from: l.piece.kind === "symbol"
        ? { kind: "piece" as const, id: l.piece.id }
        : { kind: "your oracle item" as const, id: oracleNames.get(l.piece.id) ?? `item ${l.piece.id}` },
      to: { kind: TARGET[l.target.kind], name: l.target.name },
      side: SIDE[l.aspect],
    })),
  };
}

/** The same data as readable Markdown lines, added to the export. Nothing is written when the person has none. */
export function ownMarkdown(data: OwnExport): string[] {
  const out: string[] = [];
  const day = (d: string | Date) => new Date(d).toISOString().slice(0, 10);

  if (data.own_archetypes.length) {
    out.push(``, `## Your own archetypes`);
    for (const a of data.own_archetypes) {
      out.push(``, `### ${a.name}${a.group ? ` (${a.group})` : ""}`);
      if (a.summary) out.push(``, a.summary);
      if (a.good_side) out.push(``, `**When it goes well:** ${a.good_side}`);
      if (a.hard_side) out.push(``, `**When it is hard:** ${a.hard_side}`);
      const under = data.own_concepts.filter((c) => c.sits_under?.kind === "your archetype" && c.sits_under.name === a.name);
      if (under.length) out.push(``, `Concepts under it: ${under.map((c) => c.name).join(", ")}`);
    }
  }

  if (data.own_concepts.length) {
    out.push(``, `## Your own concepts`);
    for (const c of data.own_concepts) {
      out.push(``, `### ${c.name}${c.sits_under ? ` (under ${c.sits_under.name})` : ""}`);
      if (c.realm) out.push(``, `Realm: ${c.realm}`);
      if (c.description) out.push(``, c.description);
      out.push(``, `Written ${day(c.made_at)}.`);
    }
  }

  if (data.own_names.length) {
    out.push(``, `## Your own names for pieces`, ``);
    for (const n of data.own_names) out.push(`- ${n.piece}: ${n.name}`);
  }

  if (data.cloths.length) {
    out.push(``, `## Your cloths`);
    for (const c of data.cloths) {
      out.push(``, `### ${c.name}`);
      if (c.description) out.push(``, c.description);
      if (c.zones.length) out.push(``, ...c.zones.map((z) => `- ${z.name} (${z.shape})${z.note ? `: ${z.note}` : ""}`));
    }
  }

  if (data.cloth_placements.length) {
    out.push(``, `## Where your items landed on your cloths`, ``);
    for (const p of data.cloth_placements) {
      out.push(`- ${day(p.reading.made_at)}, ${p.reading.tool} reading ${p.reading.id}, on ${p.cloth}: ${p.item} ${p.where}${p.facing ? `, ${p.facing}` : ""}${p.thrown_by_the_app ? " (thrown by the app)" : ""}`);
    }
  }

  if (data.own_links.length) {
    out.push(``, `## Your own links from pieces to archetypes and concepts`, ``);
    for (const l of data.own_links) {
      out.push(`- ${l.from.id}${l.from.kind === "your oracle item" ? " (your oracle item)" : ""} → ${l.to.name} (${l.to.kind}${l.side === "either" ? "" : `, ${l.side}`})`);
    }
  }
  return out;
}
