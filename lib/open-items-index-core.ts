// Builds the short index of docs/open-items.md. Pure: no files, no database.
// A session reads the index (about 2k tokens) and Greps an ID for the full row.

export type OpenItemRow = {
  id: string;
  status: string;
  summary: string;
  section: string;
};

const ID_PATTERN = /^[A-Z]{1,4}\d{1,3}[a-z]?/;
const SUMMARY_LIMIT = 150;

function splitCells(line: string): string[] {
  return line
    .slice(1, line.endsWith("|") ? -1 : undefined)
    .split(/(?<!\\)\|/)
    .map((cell) => cell.replace(/\\\|/g, "|").trim());
}

export function summarise(text: string): string {
  const plain = text.replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
  const stop = plain.search(/[.;:] (?=[A-Z`(])/);
  const firstPart = stop > 20 ? plain.slice(0, stop + 1) : plain;
  if (firstPart.length <= SUMMARY_LIMIT) return firstPart;
  const cut = firstPart.slice(0, SUMMARY_LIMIT);
  const lastSpace = cut.lastIndexOf(" ");
  return cut.slice(0, lastSpace > 60 ? lastSpace : SUMMARY_LIMIT) + "…";
}

export function parseOpenItems(markdown: string): OpenItemRow[] {
  const rows: OpenItemRow[] = [];
  let section = "";
  for (const line of markdown.split(/\r?\n/)) {
    if (line.startsWith("## ")) {
      section = line.slice(3).trim();
      continue;
    }
    if (!line.startsWith("|")) continue;
    const cells = splitCells(line);
    if (cells.length < 3) continue;
    const idMatch = cells[0].replace(/\*\*/g, "").match(ID_PATTERN);
    if (!idMatch) continue;
    rows.push({
      id: idMatch[0],
      status: cells[1].replace(/\*\*/g, ""),
      summary: summarise(cells[2]),
      section,
    });
  }
  return rows;
}

export function buildIndex(markdown: string): string {
  const rows = parseOpenItems(markdown);
  const lines: string[] = [
    "# Open items: index",
    "",
    "Generated from `docs/open-items.md` by `npx tsx scripts/open-items-index.ts`. Do not edit by hand.",
    "Read this list to see what is open. To work on an item, Grep its ID in `docs/open-items.md` for the full row and its evidence; do not read that file whole.",
    "",
  ];
  let section = "";
  for (const row of rows) {
    if (row.section !== section) {
      section = row.section;
      lines.push("", `## ${section}`, "");
    }
    lines.push(`- **${row.id}** (${row.status}) ${row.summary}`);
  }
  lines.push("");
  return lines.join("\n");
}
