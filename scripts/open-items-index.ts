// Regenerates docs/open-items-index.md from docs/open-items.md. No database, no network.
// Run after any change to docs/open-items.md: npx tsx scripts/open-items-index.ts
import { readFileSync, writeFileSync } from "node:fs";
import { buildIndex } from "../lib/open-items-index-core";

const source = readFileSync("docs/open-items.md", "utf8");
const index = buildIndex(source);
writeFileSync("docs/open-items-index.md", index);
process.stdout.write(`Wrote docs/open-items-index.md (${index.split("\n").length} lines)\n`);
