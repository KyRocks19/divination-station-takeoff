import { CONCEPT_WORDING } from "./concept-wording-data";

// Applies lib/concept-wording-data.ts to a database: reworded names become the display name (the old one is kept as an alias that
// search and import still find), and the sensitive and insulting ones get their mark. Safe to run again: a concept already in its
// final state is left alone. Used by scripts/apply-concept-wording.ts (dev or live) and by the local edition's first run.

type Run = (sql: string, params: unknown[]) => Promise<{ rows: any[] }>;

export interface WordingReport {
  renamed: string[];
  marked: string[];
  already: number;
  missing: string[];
  clashes: string[];
}

/** The old name as a search word: letters, numbers, plus signs, apostrophes, spaces and hyphens only (no emoji, no hidden spaces). */
export function aliasOf(displayName: string): string {
  return displayName.replace(/[^\p{L}\p{N}+' -]/gu, "").replace(/\s+/g, " ").trim();
}

export async function applyConceptWording(run: Run, write: boolean): Promise<WordingReport> {
  const report: WordingReport = { renamed: [], marked: [], already: 0, missing: [], clashes: [] };
  for (const w of CONCEPT_WORDING) {
    const found = (await run("SELECT id, display_name, sensitivity, aliases FROM concepts WHERE name = $1", [w.name])).rows[0] as
      | { id: number; display_name: string; sensitivity: string | null; aliases: string[] }
      | undefined;
    if (!found) {
      report.missing.push(w.name);
      continue;
    }
    let changed = false;
    if (w.shownAs && found.display_name !== w.shownAs) {
      const clash = (await run("SELECT 1 FROM concepts WHERE lower(display_name) = lower($1) AND id <> $2", [w.shownAs, found.id])).rows[0];
      if (clash) {
        report.clashes.push(`${aliasOf(found.display_name)} -> ${w.shownAs}`);
        continue;
      } else {
        const alias = aliasOf(found.display_name);
        const aliases = alias && !found.aliases.some((a) => a.toLowerCase() === alias.toLowerCase()) ? [...found.aliases, alias] : found.aliases;
        if (write) await run("UPDATE concepts SET display_name = $1, aliases = $2 WHERE id = $3", [w.shownAs, aliases, found.id]);
        report.renamed.push(`${alias} -> ${w.shownAs}`);
        changed = true;
      }
    }
    if (w.sensitivity && found.sensitivity !== w.sensitivity) {
      if (write) await run("UPDATE concepts SET sensitivity = $1 WHERE id = $2", [w.sensitivity, found.id]);
      report.marked.push(`${aliasOf(found.display_name)} (${w.sensitivity})`);
      changed = true;
    }
    if (!changed) report.already++;
  }
  return report;
}
