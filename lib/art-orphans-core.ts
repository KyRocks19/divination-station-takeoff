// Finding picture files that no database row points to, and rows whose file is gone (open item P5). No imports and no disk or database
// access, so the tests use it; scripts/find-stray-art.ts reads the folder and the databases and hands the lists here.

/** What a file in the art folder is, judged by its name alone. */
export type ArtFileKind = "picture" | "thumb" | "part" | "other";

const KEY = /^(\d+)\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(png|jpg|webp|json)$/;

/** The names the app gives its files (lib/art-store.ts): a picture, its small preview, or a half-written file. Anything else is "other". */
export function classifyArtFile(rel: string): { kind: ArtFileKind; key?: string } {
  if (KEY.test(rel)) return { kind: "picture", key: rel };
  if (rel.endsWith(".thumb.webp") && KEY.test(rel.slice(0, -".thumb.webp".length))) return { kind: "thumb", key: rel.slice(0, -".thumb.webp".length) };
  if (rel.endsWith(".part") && KEY.test(rel.slice(0, -".part".length))) return { kind: "part" };
  return { kind: "other" };
}

export interface ArtReport {
  /** Picture files that none of the databases has a row for. */
  strays: string[];
  /** Previews whose picture file is gone. */
  strayThumbs: string[];
  /** Half-written files (a picture being saved, or one that was interrupted). */
  parts: string[];
  /** Files that are not named the way the app names them. Never touched. */
  other: string[];
  /** For each database, the keys its rows name that have no file on disk. */
  missing: string[][];
  pictures: number;
}

/**
 * Compares the folder with the rows. `files` are paths relative to the art folder with forward slashes; `keysByDatabase` has one list of
 * file keys per database read. A file counts as a stray only when NO database has a row for it: the dev branch and the live database
 * share one folder, so a file the dev branch does not know may be live's.
 */
export function compareArt(files: string[], keysByDatabase: string[][]): ArtReport {
  const known = new Set<string>();
  for (const keys of keysByDatabase) for (const k of keys) known.add(k);
  const onDisk = new Set<string>();
  const report: ArtReport = { strays: [], strayThumbs: [], parts: [], other: [], missing: keysByDatabase.map(() => []), pictures: 0 };
  for (const rel of [...files].sort()) {
    const c = classifyArtFile(rel);
    if (c.kind === "picture") {
      onDisk.add(rel);
      report.pictures++;
      if (!known.has(rel)) report.strays.push(rel);
    } else if (c.kind === "part") report.parts.push(rel);
    else if (c.kind === "other") report.other.push(rel);
  }
  for (const rel of [...files].sort()) {
    const c = classifyArtFile(rel);
    if (c.kind === "thumb" && !onDisk.has(c.key!)) report.strayThumbs.push(rel);
  }
  keysByDatabase.forEach((keys, i) => {
    report.missing[i] = [...new Set(keys)].filter((k) => !onDisk.has(k)).sort();
  });
  return report;
}

/** Whether a file is old enough to move: a picture saved a moment ago may not have its row yet. */
export function oldEnough(modifiedMs: number, nowMs: number, minHours = 24): boolean {
  return nowMs - modifiedMs >= minHours * 3_600_000;
}
