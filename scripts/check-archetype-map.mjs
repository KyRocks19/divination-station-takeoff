// Reads data/concept-archetypes-*.txt and a concepts dump (JSON array of {name}), and lists concepts with no archetype.
// Usage: node scripts/check-archetype-map.mjs <concepts.json> <out-missing.txt>
import fs from "fs";
import path from "path";

const rows = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const norm = (s) => s.toLowerCase().replace(/[​]/g, "").replace(/[.“”"]/g, "").replace(/\s+/g, " ").trim();
const db = new Map(rows.map((r) => [norm(r.name), r.name]));
const assigned = new Map();
const files = fs.readdirSync("data").filter((f) => /^concept-archetypes-\d.*\.txt$/.test(f)).sort();
for (const f of files) {
  for (const line of fs.readFileSync(path.join("data", f), "utf8").split("\n")) {
    if (!line.trim() || line.startsWith("#")) continue;
    const i = line.indexOf("|");
    const slug = line.slice(0, i).trim();
    for (let n of line.slice(i + 1).split(";")) {
      n = n.trim().replace(/[-~]$/, "").trim();
      const k = norm(n);
      if (db.has(k) && !assigned.has(k)) assigned.set(k, slug);
    }
  }
}
const missing = [...db.keys()].filter((k) => !assigned.has(k));
console.log("concepts", db.size, "assigned", assigned.size, "missing", missing.length);
fs.writeFileSync(process.argv[3], missing.join("|"));
