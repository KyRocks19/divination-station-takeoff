import { query } from "./db";
import { allOwnLinks, listOwnArchetypes, listOwnConcepts } from "./own-archetypes";
import { shapeOwnExport, type ClothExportInput, type OwnExport } from "./export-own-core";
import { ownNames } from "./own-names";
import { listCloths, loadCloth } from "./cloths";

// Reads a person's own archetypes, concepts and links for the data export (see lib/export-own-core.ts). Every read is for one person.

/** The person's cloths and where items landed on them. */
async function collectCloths(userId: number): Promise<ClothExportInput> {
  const list = await listCloths(userId);
  const cloths = [];
  for (const c of list) {
    const full = await loadCloth(userId, c.id);
    if (full) cloths.push({ name: full.name, description: full.description, zones: full.zones });
  }
  const placements = await query<ClothExportInput["placements"][number]>(
    `SELECT p.divination_id, d.kind, d.created_at AS made_at, p.cloth_name, p.item_label, p.where_kind, p.zone_name, p.facing, p.simulated
     FROM cloth_placements p JOIN divinations d ON d.id = p.divination_id
     WHERE p.user_id = $1 AND d.user_id = $1 ORDER BY d.created_at, p.divination_id, p.item_index`,
    [userId]
  );
  return { cloths, placements };
}

/** Everything of the person's own in this part of the app. */
export async function collectOwn(userId: number): Promise<OwnExport> {
  const [archetypes, concepts, links, oracle, names, cloth] = await Promise.all([
    listOwnArchetypes(userId),
    listOwnConcepts(userId),
    allOwnLinks(userId),
    query<{ id: number; name: string }>("SELECT id, name FROM oracle_cards WHERE user_id = $1", [userId]),
    ownNames(userId),
    collectCloths(userId),
  ]);
  return shapeOwnExport(archetypes, concepts, links, new Map(oracle.map((o) => [o.id, o.name])), names, cloth);
}
