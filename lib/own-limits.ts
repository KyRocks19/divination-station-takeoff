// How many of their own archetypes, concepts and links a person may keep, and the longest each field may be (the same
// lengths as the CHECKs in migration 060). A tiny file with no imports, so screens that run in the browser can use it
// without pulling in the data files that lib/own-archetypes-core.ts reads.

/** How many a person may keep. The database does not enforce these; the routes do. */
export const LIMITS = {
  archetypes: 100,
  concepts: 300,
  links: 1000,
} as const;

/** Field lengths, the same as the CHECKs in migration 060. */
export const MAX = { name: 80, realm: 80, summary: 600, side: 600, description: 1000 } as const;
