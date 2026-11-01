// The reference bundle of the full local edition: the shared concepts (the encyclopedia) with their card links and archetype links, in one JSON file.
// The archetypes and the tool pieces' links are in the repository, so a fresh local folder always gets those (lib/local-seed.ts). The concepts come
// from spreadsheets outside the repository (docs/provenance.md, item 4), so they travel only in a bundle the owner makes with
// scripts/export-reference-bundle.ts, and a copy without the bundle simply has no encyclopedia. This file only reads and checks the bundle: no
// database, no files, no imports of the app, so the tests use it.

export interface BundleConcept { name: string; display_name: string; description: string | null }
export interface BundleCardConcept { card_id: string; concept: string; reversed: boolean }
export interface BundleConceptArchetype { concept: string; slug: string; aspect: "light" | "shadow" | "neutral"; primary: boolean }
export interface ReferenceBundle {
  format: "ds-reference-bundle";
  version: 1;
  concepts: BundleConcept[];
  card_concepts: BundleCardConcept[];
  concept_archetypes: BundleConceptArchetype[];
}

export const BUNDLE_FORMAT = "ds-reference-bundle";
const ASPECTS = ["light", "shadow", "neutral"];
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Reads and checks a bundle's text. Every problem is listed (never thrown) so one wrong row does not hide the others; a row that does not hold up is a problem, not skipped. */
export function parseBundle(text: string, knownSlugs: Set<string>): { bundle: ReferenceBundle | null; problems: string[] } {
  const problems: string[] = [];
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { bundle: null, problems: ["The bundle is not valid JSON."] };
  }
  if (!isObj(raw) || raw.format !== BUNDLE_FORMAT || raw.version !== 1) return { bundle: null, problems: [`The bundle is not a ${BUNDLE_FORMAT} file of version 1.`] };
  const list = (key: string): unknown[] => {
    const v = raw[key];
    if (!Array.isArray(v)) { problems.push(`"${key}" is missing or not a list.`); return []; }
    return v;
  };
  const names = new Set<string>();
  const concepts: BundleConcept[] = [];
  list("concepts").forEach((c, i) => {
    if (!isObj(c) || typeof c.name !== "string" || !c.name.trim() || c.name.length > 300 || typeof c.display_name !== "string" || !c.display_name.trim() || c.display_name.length > 300
      || !(c.description === null || c.description === undefined || (typeof c.description === "string" && c.description.length <= 20000))) {
      problems.push(`concepts[${i}] is not a concept.`);
      return;
    }
    if (names.has(c.name)) { problems.push(`concepts[${i}]: "${c.name}" appears twice.`); return; }
    names.add(c.name);
    concepts.push({ name: c.name, display_name: c.display_name, description: typeof c.description === "string" ? c.description : null });
  });
  const cardConcepts: BundleCardConcept[] = [];
  list("card_concepts").forEach((e, i) => {
    if (!isObj(e) || typeof e.card_id !== "string" || !e.card_id || e.card_id.length > 80 || typeof e.concept !== "string" || !names.has(e.concept) || typeof e.reversed !== "boolean") {
      problems.push(`card_concepts[${i}] is not a link between a card and a concept in this bundle.`);
      return;
    }
    cardConcepts.push({ card_id: e.card_id, concept: e.concept, reversed: e.reversed });
  });
  const conceptArchetypes: BundleConceptArchetype[] = [];
  list("concept_archetypes").forEach((e, i) => {
    if (!isObj(e) || typeof e.concept !== "string" || !names.has(e.concept) || typeof e.slug !== "string" || !knownSlugs.has(e.slug) || typeof e.aspect !== "string" || !ASPECTS.includes(e.aspect) || typeof e.primary !== "boolean") {
      problems.push(`concept_archetypes[${i}] is not a link between a concept in this bundle and an archetype this app has.`);
      return;
    }
    conceptArchetypes.push({ concept: e.concept, slug: e.slug, aspect: e.aspect as BundleConceptArchetype["aspect"], primary: e.primary });
  });
  // One primary per concept (the database has a unique index on it).
  const primaries = new Map<string, number>();
  for (const l of conceptArchetypes) if (l.primary) primaries.set(l.concept, (primaries.get(l.concept) ?? 0) + 1);
  for (const [c, n] of primaries) if (n > 1) problems.push(`"${c}" has ${n} primary archetypes.`);
  if (problems.length) return { bundle: null, problems };
  return { bundle: { format: BUNDLE_FORMAT, version: 1, concepts, card_concepts: cardConcepts, concept_archetypes: conceptArchetypes }, problems };
}

/** Splits a list into chunks, so one statement never carries tens of thousands of parameters. */
export function chunks<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
